$base = "C:\Users\ondie\Desktop\LittleLoom\src"

# ═══════════════════════════════════════════════════════════════════════════
# 1. UNIVERSAL TRACKER HUB — Surgical string replacements
# ═══════════════════════════════════════════════════════════════════════════
$hubPath = "$base\screens\tracking\UniversalTrackerHubScreen.tsx"
$hub = Get-Content -Raw -Path $hubPath

# 1a. Remove TrackerBrowserModal component block entirely
$browserMarker = $hub.IndexOf('TRACKER BROWSER MODAL')
$browserStart = $hub.LastIndexOf('/* ', $browserMarker)
$browserEnd   = $hub.IndexOf("TrackerBrowserModal.displayName = 'TrackerBrowserModal';", $browserMarker)
$browserEnd   = $hub.IndexOf("`n", $browserEnd) + 1
$hub = $hub.Remove($browserStart, $browserEnd - $browserStart)

# 1b. Replace TrackerActionModal with smoother, rounded version
$actionMarker = $hub.IndexOf('TRACKER ACTION MODAL')
$actionStart  = $hub.LastIndexOf('/* ', $actionMarker)
$actionEnd    = $hub.IndexOf("TrackerActionModal.displayName = 'TrackerActionModal';", $actionMarker)
$actionEnd    = $hub.IndexOf("`n", $actionEnd) + 1

$newActionModal = @'
/* ═══════════════════════════════════════════════════════════════════════════
   TRACKER ACTION MODAL — Smoother, rounded, with drag handle
   ═══════════════════════════════════════════════════════════════════════════ */

const TrackerActionModal = React.memo(({
  visible, trackerId, onClose, onSelect,
}: {
  visible: boolean;
  trackerId: string | null;
  onClose: () => void;
  onSelect: (trackerId: string, subAction: TrackerSubAction) => void;
}) => {
  const { fullThemeColors, isDark, borderRadiusValue } = useCustomization();
  const theme = useHubTheme();
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 12, stiffness: 200, mass: 0.8 });
      opacity.value = withTiming(1, { duration: 280 });
    } else {
      scale.value = withTiming(0.95, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible || !trackerId) return null;

  const config = TRACKER_CONFIGS[trackerId] || {
    emoji: '📋',
    color: '#667eea',
    gradient: ['#667eea', '#764ba2'] as [string, string],
    description: 'Track activity',
    category: 'essential',
    subActions: [{ id: 'default', label: 'Add Entry', icon: 'add-circle-outline' as const, color: '#667eea' }],
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.35)' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.modalContent, 
            animStyle, 
            { 
              borderRadius: Math.max(28, borderRadiusValue * 2.5),
              backgroundColor: fullThemeColors?.surface || (isDark ? '#1e1e2e' : '#ffffff'),
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 20 },
              shadowOpacity: 0.2,
              shadowRadius: 40,
              elevation: 20,
            }
          ]}
          onStartShouldSetResponder={() => true}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <View style={styles.modalDragHandle}>
            <View style={[styles.modalDragPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)' }]} />
          </View>

          <LinearGradient
            colors={config.gradient}
            style={[styles.modalHeader, {
              borderTopLeftRadius: Math.max(28, borderRadiusValue * 2.5),
              borderTopRightRadius: Math.max(28, borderRadiusValue * 2.5),
            }]}
          >
            <View style={styles.modalHeaderContent}>
              <Text style={styles.modalEmoji}>{config.emoji}</Text>
              <Text style={styles.modalTitle}>{trackerId.charAt(0).toUpperCase() + trackerId.slice(1)}</Text>
              <Text style={styles.modalDescription}>{config.description}</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>

          <View style={[styles.modalBody, { backgroundColor: fullThemeColors?.surface || (isDark ? '#1e1e2e' : '#ffffff') }]}>
            <Text style={[styles.modalSectionTitle, { color: fullThemeColors?.textSecondary || '#64748b' }]}>
              WHAT WOULD YOU LIKE TO LOG?
            </Text>
            <View style={styles.subActionsGrid}>
              {config.subActions.map((action, index) => (
                <Animated.View
                  key={action.id}
                  entering={FadeInUp.delay(index * 60).springify()}
                  style={{ width: '50%', padding: 6 }}
                >
                  <TouchableOpacity
                    style={[
                      styles.subActionCard,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.9)',
                        borderColor: `${action.color}40`,
                        borderRadius: Math.max(16, borderRadiusValue),
                        borderWidth: 1.5,
                      }
                    ]}
                    onPress={() => onSelect(trackerId, action)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.subActionIcon, { backgroundColor: `${action.color}12` }]}>
                      <Ionicons name={action.icon} size={28} color={action.color} />
                    </View>
                    <Text style={[styles.subActionLabel, { color: fullThemeColors?.text || (isDark ? '#fff' : '#1a1a1a') }]}>
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});
TrackerActionModal.displayName = 'TrackerActionModal';
'@

$hub = $hub.Remove($actionStart, $actionEnd - $actionStart)
$hub = $hub.Insert($actionStart, $newActionModal)

# 1c. Remove showTrackerBrowser state
$hub = $hub -replace "  const \[showTrackerBrowser, setShowTrackerBrowser\] = useState\(false\);\r?\n", ""

# 1d. Add handleBrowseAll + fix solid-food presetData serialization (deep clone + longer delay)
$hub = $hub.Replace(@'
  const handleTrackerPress = useCallback((trackerId: string, hasSubActions: boolean) => {
    HAPTIC_LIGHT();
    if (hasSubActions) {
      setSelectedTrackerId(trackerId);
      setShowActionModal(true);
    } else {
      navigation.navigate('AddEntry', { trackerId });
    }
  }, [navigation]);

  const handleSubActionSelect = useCallback((trackerId: string, action: TrackerSubAction) => {
    HAPTIC_MEDIUM();
    setShowActionModal(false);
    setTimeout(() => navigation.navigate('AddEntry', { trackerId, presetData: action.presetData }), 100);
  }, [navigation]);
'@, @'
  const handleTrackerPress = useCallback((trackerId: string, hasSubActions: boolean) => {
    HAPTIC_LIGHT();
    if (hasSubActions) {
      setSelectedTrackerId(trackerId);
      setShowActionModal(true);
    } else {
      navigation.navigate('AddEntry', { trackerId });
    }
  }, [navigation]);

  const handleBrowseAll = useCallback(() => {
    HAPTIC_LIGHT();
    navigation.navigate('AllTrackers' as never);
  }, [navigation]);

  const handleSubActionSelect = useCallback((trackerId: string, action: TrackerSubAction) => {
    HAPTIC_MEDIUM();
    setShowActionModal(false);
    const cleanPreset = action.presetData ? JSON.parse(JSON.stringify(action.presetData)) : undefined;
    setTimeout(() => navigation.navigate('AddEntry', { trackerId, presetData: cleanPreset }), 250);
  }, [navigation]);
'@)

# 1e. Remove TrackerBrowserModal JSX
$hub = $hub.Replace(@'
      {/* ── MODALS ── */}
      <TrackerBrowserModal
        visible={showTrackerBrowser}
        trackerCards={trackerCards}
        pinnedIds={pinnedTrackerIds}
        hiddenIds={hiddenTrackerIds}
        onClose={() => setShowTrackerBrowser(false)}
        onTrackerPress={(id, hasSub) => {
          setShowTrackerBrowser(false);
          setTimeout(() => handleTrackerPress(id, hasSub), 100);
        }}
        onPinToggle={handlePinToggle}
        onHideToggle={handleHideToggle}
        onCustomPress={handleCreateCustom}
      />
'@, @'
      {/* ── MODALS ── */}
'@)

# 1f. Wire Browse All to the new screen
$hub = $hub.Replace('onBrowseAll={() => setShowTrackerBrowser(true)}', 'onBrowseAll={handleBrowseAll}')

# 1g. Update modal styles (rounded, shadow, drag handle)
$hub = $hub.Replace(@'
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: SCREEN_WIDTH - 40,
    maxHeight: SCREEN_HEIGHT * 0.7,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
'@, @'
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: SCREEN_HEIGHT * 0.72,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 20,
  },
  modalDragHandle: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  modalDragPill: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
'@)

Set-Content -Path $hubPath -Value $hub -Encoding UTF8
Write-Host "✅ UniversalTrackerHubScreen.tsx patched"

# ═══════════════════════════════════════════════════════════════════════════
# 2. TRACK SCREEN — Complete rewrite as All Trackers screen
# ═══════════════════════════════════════════════════════════════════════════
$trackScreen = @'
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCustomization } from '../../hooks/useCustomization';
import { useTracker } from '../../hooks/useTrackerContext';
import { useBaby } from '../../context/BabyContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SPACING = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, xxxxl: 48,
};

const RADIUS = {
  xs: 6, sm: 10, md: 14, lg: 18, xl: 22, full: 999,
};

const SHADOW = {
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 24, elevation: 6 },
};

interface TrackerSubAction {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  presetData?: Record<string, unknown>;
}

interface TrackerConfig {
  emoji: string;
  color: string;
  gradient: [string, string];
  description: string;
  category: 'essential' | 'health' | 'development' | 'care';
  subActions: TrackerSubAction[];
}

const TRACKER_CONFIGS: Record<string, TrackerConfig> = {
  feed: {
    emoji: '🍼',
    color: '#fa709a',
    gradient: ['#fa709a', '#f5576c'],
    description: 'Feeding sessions',
    category: 'essential',
    subActions: [
      { id: 'breast_left', label: 'Left Breast', icon: 'arrow-back-outline', color: '#f472b6', presetData: { feedType: 'breast', side: 'left' } },
      { id: 'breast_right', label: 'Right Breast', icon: 'arrow-forward-outline', color: '#f472b6', presetData: { feedType: 'breast', side: 'right' } },
      { id: 'breast_both', label: 'Both Sides', icon: 'swap-horizontal-outline', color: '#ec4899', presetData: { feedType: 'breast', side: 'both' } },
      { id: 'bottle', label: 'Bottle', icon: 'beaker-outline', color: '#3b82f6', presetData: { feedType: 'bottle' } },
      { id: 'solid', label: 'Solid Food', icon: 'restaurant-outline', color: '#f59e0b', presetData: { feedType: 'solid' } },
    ],
  },
  sleep: {
    emoji: '🌙',
    color: '#11998e',
    gradient: ['#11998e', '#38ef7d'],
    description: 'Sleep tracking',
    category: 'essential',
    subActions: [
      { id: 'nap', label: 'Start Nap', icon: 'sunny-outline', color: '#10b981', presetData: { sleepType: 'nap', status: 'started' } },
      { id: 'bedtime', label: 'Bedtime', icon: 'moon-outline', color: '#6366f1', presetData: { sleepType: 'night', status: 'started' } },
      { id: 'end', label: 'End Sleep', icon: 'alarm-outline', color: '#f59e0b', presetData: { status: 'ended' } },
    ],
  },
  diaper: {
    emoji: '👶',
    color: '#8B5CF6',
    gradient: ['#8B5CF6', '#A78BFA'],
    description: 'Diaper changes',
    category: 'essential',
    subActions: [
      { id: 'wet', label: 'Wet', icon: 'water-outline', color: '#3b82f6', presetData: { type: 'wet' } },
      { id: 'dirty', label: 'Dirty', icon: 'flame-outline', color: '#8B4513', presetData: { type: 'dirty' } },
      { id: 'both', label: 'Both', icon: 'water', color: '#8B5CF6', presetData: { type: 'both' } },
      { id: 'dry', label: 'Dry', icon: 'checkmark-circle-outline', color: '#10b981', presetData: { type: 'dry' } },
    ],
  },
  potty: {
    emoji: '💧',
    color: '#667eea',
    gradient: ['#667eea', '#764ba2'],
    description: 'Potty training',
    category: 'development',
    subActions: [
      { id: 'wet', label: 'Wet', icon: 'water-outline', color: '#3b82f6', presetData: { type: 'wet', successful: true } },
      { id: 'dirty', label: 'Dirty', icon: 'flame-outline', color: '#8B4513', presetData: { type: 'dirty', successful: true } },
      { id: 'both', label: 'Both', icon: 'water', color: '#667eea', presetData: { type: 'both', successful: true } },
      { id: 'dry', label: 'Dry Attempt', icon: 'close-circle-outline', color: '#94a3b8', presetData: { type: 'dry', successful: false } },
    ],
  },
  growth: {
    emoji: '📏',
    color: '#43e97b',
    gradient: ['#43e97b', '#38f9d7'],
    description: 'Growth measurements',
    category: 'health',
    subActions: [
      { id: 'weight', label: 'Weight', icon: 'scale-outline', color: '#10b981', presetData: { measurementType: 'weight' } },
      { id: 'height', label: 'Height', icon: 'resize-outline', color: '#3b82f6', presetData: { measurementType: 'height' } },
      { id: 'head', label: 'Head', icon: 'ellipse-outline', color: '#f59e0b', presetData: { measurementType: 'head' } },
    ],
  },
  milestone: {
    emoji: '🏆',
    color: '#ffd700',
    gradient: ['#ffd700', '#ffaa00'],
    description: 'Development milestones',
    category: 'development',
    subActions: [
      { id: 'physical', label: 'Physical', icon: 'body-outline', color: '#f59e0b', presetData: { category: 'physical' } },
      { id: 'cognitive', label: 'Cognitive', icon: 'bulb-outline', color: '#8b5cf6', presetData: { category: 'cognitive' } },
      { id: 'social', label: 'Social', icon: 'people-outline', color: '#ec4899', presetData: { category: 'social' } },
      { id: 'language', label: 'Language', icon: 'chatbubble-outline', color: '#3b82f6', presetData: { category: 'language' } },
    ],
  },
  medication: {
    emoji: '💊',
    color: '#ff6b6b',
    gradient: ['#ff6b6b', '#ee5a5a'],
    description: 'Health & medication',
    category: 'health',
    subActions: [
      { id: 'medicine', label: 'Medicine', icon: 'medical-outline', color: '#ef4444', presetData: { type: 'medicine' } },
      { id: 'temperature', label: 'Temperature', icon: 'thermometer-outline', color: '#f59e0b', presetData: { type: 'temperature' } },
      { id: 'symptom', label: 'Symptom', icon: 'alert-circle-outline', color: '#8b5cf6', presetData: { type: 'symptom' } },
      { id: 'vaccine', label: 'Vaccination', icon: 'shield-checkmark-outline', color: '#10b981', presetData: { type: 'vaccine' } },
    ],
  },
  pumping: {
    emoji: '🤱',
    color: '#ec4899',
    gradient: ['#ec4899', '#f472b6'],
    description: 'Pumping sessions',
    category: 'care',
    subActions: [
      { id: 'left', label: 'Left', icon: 'arrow-back-outline', color: '#f472b6', presetData: { side: 'left' } },
      { id: 'right', label: 'Right', icon: 'arrow-forward-outline', color: '#f472b6', presetData: { side: 'right' } },
      { id: 'both', label: 'Both', icon: 'swap-horizontal-outline', color: '#ec4899', presetData: { side: 'both' } },
    ],
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  essential: '#10b981',
  health: '#ef4444',
  development: '#f59e0b',
  care: '#8b5cf6',
};

const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const HAPTIC_MEDIUM = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

const useHubTheme = () => {
  const { isDark, colors, fullThemeColors } = useCustomization();
  return useMemo(() => ({
    primary: colors?.primary || '#667eea',
    secondary: colors?.secondary || '#764ba2',
    isDark: !!isDark,
    text: {
      primary: fullThemeColors?.text || (isDark ? '#ffffff' : '#1a1a1a'),
      secondary: fullThemeColors?.textSecondary || (isDark ? '#94a3b8' : '#64748b'),
      muted: fullThemeColors?.textMuted || (isDark ? '#64748b' : '#94a3b8'),
    },
    surface: {
      bg: fullThemeColors?.surface || (isDark ? 'rgba(30,30,45,0.8)' : 'rgba(255,255,255,0.9)'),
      border: fullThemeColors?.border || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
    },
  }), [isDark, colors, fullThemeColors]);
};

const GlassCard = React.memo(({ 
  children, 
  style, 
  onPress, 
  active = false,
  shadow = 'md',
}: { 
  children: React.ReactNode; 
  style?: any; 
  onPress?: () => void; 
  active?: boolean;
  shadow?: keyof typeof SHADOW;
}) => {
  const theme = useHubTheme();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper 
      onPress={onPress} 
      activeOpacity={onPress ? 0.85 : 1} 
      style={[
        styles.glassCard,
        SHADOW[shadow],
        active && { borderColor: theme.primary, borderWidth: 2 },
        style
      ]}
    >
      <LinearGradient
        colors={theme.isDark 
          ? ['rgba(45,45,60,0.9)', 'rgba(35,35,50,0.7)'] 
          : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.8)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.glassBorder, { 
        backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)' 
      }]} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
});
GlassCard.displayName = 'GlassCard';

const SubActionSheet = React.memo(({
  visible,
  trackerId,
  onClose,
  onSelect,
}: {
  visible: boolean;
  trackerId: string | null;
  onClose: () => void;
  onSelect: (trackerId: string, action: TrackerSubAction) => void;
}) => {
  const { fullThemeColors, isDark, borderRadiusValue } = useCustomization();
  const theme = useHubTheme();

  if (!visible || !trackerId) return null;

  const config = TRACKER_CONFIGS[trackerId] || {
    emoji: '📋',
    color: '#667eea',
    gradient: ['#667eea', '#764ba2'] as [string, string],
    description: 'Track activity',
    category: 'essential',
    subActions: [{ id: 'default', label: 'Add Entry', icon: 'add-circle-outline' as const, color: '#667eea' }],
  };

  return (
    <View style={[styles.sheetOverlay, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      <Animated.View 
        entering={FadeInUp.springify().damping(15).stiffness(200)}
        style={[
          styles.sheetContent,
          {
            backgroundColor: fullThemeColors?.surface || (isDark ? '#1e1e2e' : '#ffffff'),
            borderRadius: Math.max(28, borderRadiusValue * 2.5),
          }
        ]}
      >
        <View style={styles.sheetHandle}>
          <View style={[styles.sheetHandlePill, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />
        </View>

        <LinearGradient
          colors={config.gradient}
          style={[styles.sheetHeader, {
            borderTopLeftRadius: Math.max(28, borderRadiusValue * 2.5),
            borderTopRightRadius: Math.max(28, borderRadiusValue * 2.5),
          }]}
        >
          <Text style={styles.sheetEmoji}>{config.emoji}</Text>
          <Text style={styles.sheetTitle}>{trackerId.charAt(0).toUpperCase() + trackerId.slice(1)}</Text>
          <Text style={styles.sheetDesc}>{config.description}</Text>
          <TouchableOpacity style={styles.sheetCloseBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>

        <View style={[styles.sheetBody, { backgroundColor: fullThemeColors?.surface || (isDark ? '#1e1e2e' : '#ffffff') }]}>
          <Text style={[styles.sheetSectionTitle, { color: theme.text.muted }]}>
            SELECT AN OPTION
          </Text>
          <View style={styles.subActionsGrid}>
            {config.subActions.map((action, index) => (
              <Animated.View
                key={action.id}
                entering={FadeInUp.delay(index * 50).springify()}
                style={{ width: '50%', padding: 6 }}
              >
                <TouchableOpacity
                  style={[
                    styles.subActionCard,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.9)',
                      borderColor: `${action.color}35`,
                      borderRadius: Math.max(16, borderRadiusValue),
                    }
                  ]}
                  onPress={() => onSelect(trackerId, action)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.subActionIcon, { backgroundColor: `${action.color}12` }]}>
                    <Ionicons name={action.icon} size={26} color={action.color} />
                  </View>
                  <Text style={[styles.subActionLabel, { color: theme.text.primary }]}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
  );
});
SubActionSheet.displayName = 'SubActionSheet';

type AllTrackersNavProp = NativeStackNavigationProp<RootStackParamList>;

export default function AllTrackersScreen() {
  const navigation = useNavigation<AllTrackersNavProp>();
  const insets = useSafeAreaInsets();
  const { isDark, fullThemeColors, colors, borderRadiusValue } = useCustomization();
  const { entries, getEntries, trackers } = useTracker();
  const { currentBaby } = useBaby();
  const theme = useHubTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(null);
  const [showSubSheet, setShowSubSheet] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('@littleloom_pinned_trackers'),
      AsyncStorage.getItem('@littleloom_hidden_trackers'),
    ]).then(([pinned, hidden]) => {
      if (pinned) setPinnedIds(JSON.parse(pinned));
      if (hidden) setHiddenIds(JSON.parse(hidden));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('@littleloom_pinned_trackers', JSON.stringify(pinnedIds)).catch(() => {});
  }, [pinnedIds]);

  useEffect(() => {
    AsyncStorage.setItem('@littleloom_hidden_trackers', JSON.stringify(hiddenIds)).catch(() => {});
  }, [hiddenIds]);

  const trackerCards = useMemo(() => {
    if (!currentBaby) return [];
    const sourceTrackers = trackers?.length > 0
      ? trackers
      : Object.keys(TRACKER_CONFIGS).map(id => ({
          id,
          name: id.charAt(0).toUpperCase() + id.slice(1),
          emoji: TRACKER_CONFIGS[id].emoji,
          color: TRACKER_CONFIGS[id].color,
          gradient: TRACKER_CONFIGS[id].gradient,
          category: TRACKER_CONFIGS[id].category,
        }));

    return sourceTrackers.map((tracker: any) => {
      const id = tracker.id;
      const config = TRACKER_CONFIGS[id];
      const entriesForTracker = getEntries(id);
      const lastEntry = entriesForTracker[0];
      return {
        id,
        title: tracker.name || tracker.title || id.charAt(0).toUpperCase() + id.slice(1),
        emoji: tracker.emoji || config?.emoji || '📋',
        color: tracker.color || config?.color || '#667eea',
        gradient: (tracker.gradient || config?.gradient || ['#667eea', '#764ba2']) as [string, string],
        category: config?.category || 'essential',
        count: entriesForTracker.length,
        lastEntry: lastEntry
          ? new Date(lastEntry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : undefined,
        hasSubActions: !!config?.subActions?.length,
      };
    });
  }, [trackers, getEntries, currentBaby]);

  const categories = useMemo(() => {
    const cats = [...new Set(trackerCards.map(t => t.category))];
    return cats.sort();
  }, [trackerCards]);

  const filtered = useMemo(() => {
    let res = trackerCards.filter((t: any) => !hiddenIds.includes(t.id));
    if (activeCategory) res = res.filter((t: any) => t.category === activeCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      res = res.filter((t: any) =>
        t.title.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (TRACKER_CONFIGS[t.id]?.description || '').toLowerCase().includes(q)
      );
    }
    return res;
  }, [trackerCards, activeCategory, searchQuery, hiddenIds]);

  const handleTrackerPress = useCallback((trackerId: string, hasSubActions: boolean) => {
    HAPTIC_LIGHT();
    if (hasSubActions) {
      setSelectedTrackerId(trackerId);
      setShowSubSheet(true);
    } else {
      navigation.navigate('AddEntry', { trackerId });
    }
  }, [navigation]);

  const handleSubActionSelect = useCallback((trackerId: string, action: TrackerSubAction) => {
    HAPTIC_MEDIUM();
    setShowSubSheet(false);
    const cleanPreset = action.presetData ? JSON.parse(JSON.stringify(action.presetData)) : undefined;
    setTimeout(() => {
      navigation.navigate('AddEntry', { trackerId, presetData: cleanPreset });
    }, 200);
  }, [navigation]);

  const handlePinToggle = useCallback((id: string) => {
    HAPTIC_LIGHT();
    setPinnedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const handleHideToggle = useCallback((id: string) => {
    HAPTIC_LIGHT();
    setHiddenIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const handleCustomPress = useCallback(() => {
    HAPTIC_MEDIUM();
    navigation.navigate('CreateCustomTracker');
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: fullThemeColors?.background || '#f8faff' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient
        colors={isDark
          ? [fullThemeColors?.background || '#0a0a1a', fullThemeColors?.surface || '#12122a']
          : ['#f8fafc', '#e2e8f0', '#dbeafe']
        }
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: insets.top + 8, paddingHorizontal: SPACING.lg }]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={[styles.headerBackBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text.secondary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: theme.text.primary }]}>All Trackers</Text>
          <Text style={[styles.headerSubtitle, { color: theme.text.muted }]}>
            {filtered.length} active • {hiddenIds.length} hidden
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        <View style={[styles.searchWrap, { 
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          marginHorizontal: SPACING.lg,
          marginTop: SPACING.md,
          marginBottom: SPACING.sm,
        }]}>
          <Ionicons name="search" size={18} color={theme.text.muted} />
          <TextInput
            style={[styles.searchInput, { color: theme.text.primary }]}
            placeholder="Search trackers..."
            placeholderTextColor={theme.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.text.muted} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.categoryScroll}
        >
          <TouchableOpacity
            onPress={() => setActiveCategory(null)}
            style={[
              styles.categoryChip, 
              activeCategory === null && { backgroundColor: theme.primary }
            ]}
          >
            <Text style={[styles.categoryText, activeCategory === null && { color: '#fff' }]}>All</Text>
          </TouchableOpacity>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat}
              onPress={() => setActiveCategory(activeCategory === cat ? null : cat)}
              style={[
                styles.categoryChip,
                activeCategory === cat && { backgroundColor: CATEGORY_COLORS[cat] || theme.primary }
              ]}
            >
              <Text style={[styles.categoryText, activeCategory === cat && { color: '#fff' }]}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.grid}>
          {filtered.map((tracker: any, index: number) => {
            const isPinned = pinnedIds.includes(tracker.id);
            return (
              <Animated.View
                key={tracker.id}
                entering={FadeInUp.delay(index * 40).springify()}
                style={styles.gridItem}
              >
                <TouchableOpacity
                  onPress={() => handleTrackerPress(tracker.id, tracker.hasSubActions)}
                  activeOpacity={0.85}
                  style={{ flex: 1 }}
                >
                  <GlassCard shadow="md" style={styles.trackerCard}>
                    <View style={[styles.trackerCardTop, { justifyContent: 'space-between' }]}>
                      <View style={[styles.trackerCardIcon, { backgroundColor: `${tracker.color}12` }]}>
                        <Text style={{ fontSize: 24 }}>{tracker.emoji}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        <TouchableOpacity
                          onPress={() => handlePinToggle(tracker.id)}
                          style={[styles.actionBtn, isPinned && { backgroundColor: `${theme.primary}12` }]}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name={isPinned ? 'pin' : 'pin-outline'} size={16} color={isPinned ? theme.primary : theme.text.muted} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleHideToggle(tracker.id)}
                          style={styles.actionBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="eye-off-outline" size={16} color={theme.text.muted} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={[styles.trackerCardTitle, { color: theme.text.primary }]} numberOfLines={1}>
                      {tracker.title}
                    </Text>
                    <Text style={[styles.trackerCardDesc, { color: theme.text.muted }]} numberOfLines={1}>
                      {TRACKER_CONFIGS[tracker.id]?.description || tracker.category}
                    </Text>
                    <View style={styles.trackerCardMeta}>
                      <Text style={[styles.trackerCardCount, { color: tracker.color }]}>
                        {tracker.count} logs
                      </Text>
                      {tracker.lastEntry && (
                        <Text style={[styles.trackerCardLast, { color: theme.text.muted }]}>
                          Last {tracker.lastEntry}
                        </Text>
                      )}
                    </View>
                  </GlassCard>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        {filtered.length === 0 && (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Ionicons name="search-outline" size={48} color={theme.text.muted} />
            <Text style={{ color: theme.text.muted, marginTop: 16, fontWeight: '700', fontSize: 15 }}>
              No trackers found
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={handleCustomPress}
          style={[styles.customBtn, { borderColor: theme.surface.border, marginHorizontal: SPACING.lg, marginTop: SPACING.md }]}
        >
          <LinearGradient
            colors={[`${theme.primary}08`, `${theme.primary}02`]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={[styles.customIcon, { backgroundColor: `${theme.primary}12` }]}>
            <Ionicons name="add" size={22} color={theme.primary} />
          </View>
          <Text style={[styles.customText, { color: theme.primary }]}>Create Custom Tracker</Text>
        </TouchableOpacity>

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>

      {showSubSheet && (
        <SubActionSheet
          visible={showSubSheet}
          trackerId={selectedTrackerId}
          onClose={() => setShowSubSheet(false)}
          onSelect={handleSubActionSelect}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 2 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 4,
  },

  categoryScroll: {
    paddingHorizontal: SPACING.lg,
    gap: 8,
    paddingBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(120,120,140,0.08)',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.lg,
    gap: 10,
    marginTop: SPACING.md,
  },
  gridItem: {
    width: (SCREEN_WIDTH - 56) / 2,
  },

  glassCard: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  glassContent: { flex: 1 },

  trackerCard: {
    padding: SPACING.md,
    minHeight: 140,
  },
  trackerCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  trackerCardIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackerCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  trackerCardDesc: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 8,
  },
  trackerCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
  trackerCardCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  trackerCardLast: {
    fontSize: 10,
    fontWeight: '600',
  },

  customBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  customIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customText: { fontSize: 13, fontWeight: '700' },

  sheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 24,
    zIndex: 200,
  },
  sheetContent: {
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.65,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 20,
  },
  sheetHandle: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  sheetHandlePill: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  sheetHeader: {
    padding: 20,
    paddingTop: 28,
    alignItems: 'center',
  },
  sheetEmoji: { fontSize: 40, marginBottom: 4 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  sheetDesc: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '500', marginTop: 3 },
  sheetCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: { padding: 14 },
  sheetSectionTitle: {
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 2,
    fontSize: 12,
  },
  subActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  subActionCard: {
    alignItems: 'center',
    padding: 12,
    gap: 8,
    borderWidth: 1.5,
  },
  subActionIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subActionLabel: { fontWeight: '700', textAlign: 'center', fontSize: 13 },
});
'@

Set-Content -Path "$base\screens\main\TrackScreen.tsx" -Value $trackScreen -Encoding UTF8
Write-Host "✅ TrackScreen.tsx written (All Trackers screen)"

# ═══════════════════════════════════════════════════════════════════════════
# 3. APP NAVIGATOR — Wire the new screen and repurpose Track tab
# ═══════════════════════════════════════════════════════════════════════════
$navPath = "$base\navigation\AppNavigator.tsx"
$nav = Get-Content -Raw -Path $navPath

# Make Track tab render the Hub directly (TrackScreen is now the stack screen)
$nav = $nav.Replace(
    '<Tab.Screen name="Track" component={TrackScreen} />',
    '<Tab.Screen name="Track" component={UniversalTrackerHubScreen} />'
)

# Add AllTrackers as a stack screen
$nav = $nav.Replace(
    '<Stack.Screen name="UniversalTrackerHub" component={UniversalTrackerHubScreen} />',
    "<Stack.Screen name=`"UniversalTrackerHub`" component={UniversalTrackerHubScreen} />`r`n        <Stack.Screen name=`"AllTrackers`" component={TrackScreen} options={{ animation: 'slide_from_right' }} />"
)

Set-Content -Path $navPath -Value $nav -Encoding UTF8
Write-Host "✅ AppNavigator.tsx patched"

Write-Host "`n🚀 All fixes applied. Add this to your RootStackParamList if TS complains:"
Write-Host "   AllTrackers: undefined;"
Write-Host "Then restart your Expo dev server (clear cache if needed)."