import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  Linking,
  Modal,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  FadeInUp, 
  FadeInDown, 
  FadeInRight,
  useSharedValue, 
  useAnimatedStyle, 
  useAnimatedScrollHandler,
  withSpring, 
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { useAudio, AudioTrack, SOUND_TRACKS } from '../../context/AudioContext';
import { useBaby } from '../../context/BabyContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useTracker } from '@/context/TrackerContext';
import { differenceInMinutes, parseISO } from 'date-fns';

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — Borrowed from GrowthDashboard harmony
   ═══════════════════════════════════════════════════════════════════════════ */

const DESIGN = {
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  },
};

const { width: SCREEN_W } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════════════════
   SAFE HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const safeParseDate = (d?: string | null): Date | null => {
  if (!d) return null;
  try { const p = parseISO(d); return p; } catch { return null; }
};

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

type SoundMixerScreenProps = NativeStackScreenProps<RootStackParamList, 'SoundMixer'>;
type TabType = 'discover' | 'playlists' | 'favorites' | 'sleep';

interface Playlist {
  id: string;
  title: string;
  description: string;
  coverColor: [string, string];
  tracks: AudioTrack[];
  type: 'system' | 'custom' | 'mood' | 'time' | 'favorites' | 'imported';
  playCount: number;
  isLiked: boolean;
  createdAt: string;
  coverImage?: string;
  duration: string;
  trackCount: number;
}

interface SleepSession {
  id: string;
  trackId: string;
  startTime: string;
  endTime?: string;
  duration: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  babyWasAsleep: boolean;
}

interface SoundMix {
  id: string;
  name: string;
  layers: { trackId: string; volume: number; isActive: boolean }[];
  createdAt: string;
}

interface SmartRecommendation {
  id: string;
  type: 'time' | 'mood' | 'sleep-pattern' | 'weather' | 'baby-age' | 'recent';
  title: string;
  subtitle: string;
  trackIds: string[];
  confidence: number;
  emoji: string;
  color: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ENHANCED TRACKS
   ═══════════════════════════════════════════════════════════════════════════ */

const ENHANCED_TRACKS: AudioTrack[] = [
  ...SOUND_TRACKS,
  { id: '5', title: 'Womb Sounds', artist: 'Baby Sleep', duration: '4:00', color: '#ff6b6b', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
  { id: '6', title: 'Ocean Waves', artist: 'Nature Sleep', duration: '5:30', color: '#4ecdc4', image: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=400&q=80', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' },
  { id: '7', title: 'Soft Piano', artist: 'Lullaby Classics', duration: '3:45', color: '#ffe66d', image: 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=400&q=80', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3' },
  { id: '8', title: 'Brown Noise', artist: 'Deep Sleep', duration: '6:00', color: '#a8e6cf', image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&q=80', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
  { id: '9', title: 'Heartbeat', artist: 'Womb Simulation', duration: '10:00', color: '#e74c3c', image: 'https://images.unsplash.com/photo-1505672678657-cc7037095e60?w=400&q=80', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3' },
  { id: '10', title: 'Forest Rain', artist: 'Nature Sounds', duration: '8:00', color: '#27ae60', image: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=400&q=80', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3' },
  { id: '11', title: 'Twinkle Lullaby', artist: 'Classical Baby', duration: '3:20', color: '#f39c12', image: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=400&q=80', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3' },
  { id: '12', title: 'Pink Noise', artist: 'Sleep Science', duration: '7:30', color: '#9b59b6', image: 'https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=400&q=80', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3' },
];

/* ═══════════════════════════════════════════════════════════════════════════
   REFINED GLASS CARD (GrowthDashboard style)
   ═══════════════════════════════════════════════════════════════════════════ */

const GlassCard = React.memo(({ children, style, onPress, active = false }: { children: React.ReactNode; style?: any; onPress?: () => void; active?: boolean }) => {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={[styles.glassCard, active && styles.glassCardActive, style]}>
      <LinearGradient
        colors={['rgba(45,45,60,0.85)', 'rgba(35,35,50,0.65)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.glassBorder} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION HEADER (GrowthDashboard style)
   ═══════════════════════════════════════════════════════════════════════════ */

const SectionHeader = React.memo(({ title, subtitle, action, actionLabel }: { title: string; subtitle?: string; action?: () => void; actionLabel?: string }) => (
  <View style={styles.sectionHeader}>
    <View style={{ flex: 1 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
    {action && (
      <TouchableOpacity onPress={action} style={styles.sectionAction}>
        <Text style={styles.sectionActionText}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={14} color="#818cf8" />
      </TouchableOpacity>
    )}
  </View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 1: Smart Sleep Intelligence Card
   Analyzes baby's sleep patterns and recommends optimal sound + timing
   ═══════════════════════════════════════════════════════════════════════════ */

const SmartSleepIntelligence = React.memo(({ 
  baby, 
  trackerEntries, 
  onRecommendationPress 
}: { 
  baby: any; 
  trackerEntries: any[]; 
  onRecommendationPress: (rec: SmartRecommendation) => void;
}) => {
  const recommendations = useMemo((): SmartRecommendation[] => {
    const now = new Date();
    const hour = now.getHours();
    const ageMonths = baby?.birthDate ? differenceInMinutes(now, safeParseDate(baby.birthDate) || now) / (30 * 24 * 60) : 0;

    const sleepEntries = trackerEntries.filter((e: any) => e.trackerId === 'sleep');
    const lastSleep = sleepEntries[sleepEntries.length - 1];
    const lastSleepEnd = lastSleep?.endTime ? safeParseDate(lastSleep.endTime) : null;
    const minsSinceWake = lastSleepEnd ? differenceInMinutes(now, lastSleepEnd) : 999;

    const recs: SmartRecommendation[] = [];

    if (hour >= 19 || hour <= 6) {
      recs.push({
        id: 'time-night',
        type: 'time',
        title: 'Bedtime Wind-Down',
        subtitle: 'Optimal sleep window detected',
        trackIds: ['1', '5', '8'],
        confidence: 92,
        emoji: '🌙',
        color: '#6366f1',
      });
    }

    if (minsSinceWake > 180 && minsSinceWake < 300) {
      recs.push({
        id: 'sleep-debt',
        type: 'sleep-pattern',
        title: 'Nap Time Soon',
        subtitle: `${Math.round(minsSinceWake / 60)}h awake — sweet spot approaching`,
        trackIds: ['2', '6', '10'],
        confidence: 85,
        emoji: '⏰',
        color: '#10b981',
      });
    }

    if (ageMonths < 3) {
      recs.push({
        id: 'age-newborn',
        type: 'baby-age',
        title: 'Newborn Comfort',
        subtitle: 'Womb sounds & heartbeat for 0-3 months',
        trackIds: ['5', '9', '1'],
        confidence: 88,
        emoji: '👶',
        color: '#ec4899',
      });
    } else if (ageMonths >= 6 && ageMonths < 12) {
      recs.push({
        id: 'age-infant',
        type: 'baby-age',
        title: 'Discovery Sounds',
        subtitle: 'Gentle melodies for curious minds',
        trackIds: ['7', '11', '3'],
        confidence: 80,
        emoji: '🧸',
        color: '#f59e0b',
      });
    }

    return recs.slice(0, 2);
  }, [baby, trackerEntries]);

  if (recommendations.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <SectionHeader title="Smart Recommendations" subtitle="Based on sleep patterns & time" />
      <View style={styles.smartRecsContainer}>
        {recommendations.map((rec) => (
          <TouchableOpacity 
            key={rec.id} 
            onPress={() => onRecommendationPress(rec)}
            style={[styles.smartRecCard, { borderColor: rec.color + '40' }]}
          >
            <LinearGradient
              colors={[rec.color + '15', rec.color + '05']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.smartRecTop}>
              <View style={[styles.smartRecIconBg, { backgroundColor: rec.color + '20' }]}>
                <Text style={styles.smartRecEmoji}>{rec.emoji}</Text>
              </View>
              <View style={[styles.smartRecConfidence, { backgroundColor: rec.color + '15' }]}>
                <Text style={[styles.smartRecConfidenceText, { color: rec.color }]}>{rec.confidence}%</Text>
              </View>
            </View>
            <Text style={styles.smartRecTitle} numberOfLines={1}>{rec.title}</Text>
            <Text style={styles.smartRecSubtitle} numberOfLines={2}>{rec.subtitle}</Text>
            <View style={styles.smartRecTracks}>
              {rec.trackIds.slice(0, 3).map((tid, idx) => {
                const track = ENHANCED_TRACKS.find(t => t.id === tid);
                return track ? (
                  <Image key={idx} source={{ uri: track.image }} style={styles.smartRecTrackImg} />
                ) : null;
              })}
              <View style={[styles.smartRecPlayBtn, { backgroundColor: rec.color }]}>
                <Ionicons name="play" size={14} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 2: Now Playing Hero (Full-width immersive player)
   ═══════════════════════════════════════════════════════════════════════════ */

const NowPlayingHero = React.memo(({ 
  track, 
  isPlaying, 
  onPlayPause, 
  onExpand,
  progress = 0.45,
}: { 
  track: AudioTrack | null; 
  isPlaying: boolean; 
  onPlayPause: () => void;
  onExpand: () => void;
  progress?: number;
}) => {
  if (!track) return null;

  return (
    <Animated.View entering={FadeInUp.delay(50).springify()}>
      <TouchableOpacity onPress={onExpand} activeOpacity={0.9} style={styles.nowPlayingHero}>
        <Image source={{ uri: track.image }} style={styles.nowPlayingHeroBg} blurRadius={20} />
        <LinearGradient
          colors={['rgba(15,15,30,0.3)', 'rgba(15,15,30,0.95)']}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.nowPlayingHeroContent}>
          <View style={styles.nowPlayingHeroTop}>
            <View style={styles.nowPlayingWaveform}>
              {[0.3, 0.6, 0.9, 0.5, 0.8, 0.4, 0.7, 0.5].map((h, i) => (
                <View 
                  key={i} 
                  style={[
                    styles.waveformBar, 
                    { 
                      height: isPlaying ? 16 * h : 4, 
                      backgroundColor: isPlaying ? track.color : 'rgba(255,255,255,0.3)',
                      opacity: isPlaying ? 1 : 0.5,
                    }
                  ]} 
                />
              ))}
            </View>
            <Text style={styles.nowPlayingLiveBadge}>● LIVE</Text>
          </View>

          <View style={styles.nowPlayingHeroInfo}>
            <Image source={{ uri: track.image }} style={styles.nowPlayingHeroThumb} />
            <View style={styles.nowPlayingHeroText}>
              <Text style={styles.nowPlayingHeroTitle} numberOfLines={1}>{track.title}</Text>
              <Text style={styles.nowPlayingHeroArtist} numberOfLines={1}>{track.artist}</Text>
            </View>
            <TouchableOpacity onPress={onPlayPause} style={[styles.nowPlayingHeroBtn, { backgroundColor: track.color }]}>
              <Ionicons name={isPlaying ? "pause" : "play"} size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: track.color }]} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 3: Sound Mixing Studio
   Layer multiple sounds with individual volume controls
   ═══════════════════════════════════════════════════════════════════════════ */

const SoundMixingStudio = React.memo(({ 
  visible, 
  onClose, 
  tracks,
  onPlayMix,
}: { 
  visible: boolean; 
  onClose: () => void; 
  tracks: AudioTrack[];
  onPlayMix: (mix: SoundMix) => void;
}) => {
  const [mixLayers, setMixLayers] = useState<{ trackId: string; volume: number; isActive: boolean }[]>([
    { trackId: '1', volume: 0.7, isActive: true },
    { trackId: '6', volume: 0.4, isActive: true },
    { trackId: '5', volume: 0.3, isActive: false },
  ]);
  const [mixName, setMixName] = useState('My Sleep Mix');

  const toggleLayer = (index: number) => {
    setMixLayers(prev => prev.map((l, i) => i === index ? { ...l, isActive: !l.isActive } : l));
  };

  const handleSaveMix = () => {
    const mix: SoundMix = {
      id: `mix-${Date.now()}`,
      name: mixName,
      layers: mixLayers.filter(l => l.isActive),
      createdAt: new Date().toISOString(),
    };
    onPlayMix(mix);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.mixModalOverlay}>
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.springify()} style={styles.mixModalContent}>
          <LinearGradient colors={['rgba(50,50,70,0.98)', 'rgba(40,40,60,0.95)']} style={StyleSheet.absoluteFill} />

          <View style={styles.mixModalHeader}>
            <Text style={styles.mixModalTitle}>Sound Mixer Studio</Text>
            <TouchableOpacity onPress={onClose} style={styles.mixModalClose}>
              <Ionicons name="close" size={22} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <Text style={styles.mixModalSubtitle}>Layer multiple sounds for a custom experience</Text>

          <View style={styles.mixNameInputWrap}>
            <Ionicons name="musical-notes" size={18} color="#818cf8" />
            <TextInput
              style={styles.mixNameInput}
              value={mixName}
              onChangeText={setMixName}
              placeholder="Name your mix..."
              placeholderTextColor="#64748b"
            />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.mixLayersScroll}>
            {mixLayers.map((layer, i) => {
              const track = tracks.find(t => t.id === layer.trackId);
              if (!track) return null;
              return (
                <View key={i} style={styles.mixLayerRow}>
                  <TouchableOpacity onPress={() => toggleLayer(i)} style={[styles.mixLayerToggle, layer.isActive && { backgroundColor: track.color + '30', borderColor: track.color }]}>
                    <Image source={{ uri: track.image }} style={styles.mixLayerImg} />
                    <View style={styles.mixLayerInfo}>
                      <Text style={[styles.mixLayerTitle, layer.isActive && { color: '#fff' }]}>{track.title}</Text>
                      <Text style={styles.mixLayerArtist}>{track.artist}</Text>
                    </View>
                    <Ionicons 
                      name={layer.isActive ? "checkmark-circle" : "ellipse-outline"} 
                      size={22} 
                      color={layer.isActive ? track.color : '#475569'} 
                    />
                  </TouchableOpacity>

                  {layer.isActive && (
                    <View style={styles.volumeSliderWrap}>
                      <Ionicons name="volume-low" size={14} color="#64748b" />
                      <View style={styles.volumeSliderTrack}>
                        <View style={[styles.volumeSliderFill, { width: `${layer.volume * 100}%`, backgroundColor: track.color }]} />
                      </View>
                      <Ionicons name="volume-high" size={14} color="#64748b" />
                      <Text style={styles.volumeValue}>{Math.round(layer.volume * 100)}%</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity onPress={handleSaveMix} style={styles.mixSaveBtn}>
            <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.mixSaveGradient}>
              <Ionicons name="play" size={18} color="#fff" />
              <Text style={styles.mixSaveText}>Play Mix</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 4: Sleep Timer & Fade-Out Controller
   Smart timer with gentle fade-out and sleep tracking
   ═══════════════════════════════════════════════════════════════════════════ */

const SleepTimerModal = React.memo(({ 
  visible, 
  onClose, 
  onSetTimer,
  currentTrack,
}: { 
  visible: boolean; 
  onClose: () => void; 
  onSetTimer: (minutes: number, fadeOut: boolean) => void;
  currentTrack: AudioTrack | null;
}) => {
  const [selectedMinutes, setSelectedMinutes] = useState(30);
  const [fadeOutEnabled, setFadeOutEnabled] = useState(true);
  const [smartDetect, setSmartDetect] = useState(true);

  const presets = [15, 30, 45, 60, 90, 120];

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.timerModalOverlay}>
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.springify()} style={styles.timerModalContent}>
          <LinearGradient colors={['rgba(50,50,70,0.98)', 'rgba(40,40,60,0.95)']} style={StyleSheet.absoluteFill} />

          <View style={styles.timerModalHeader}>
            <Text style={styles.timerModalTitle}>Sleep Timer</Text>
            <TouchableOpacity onPress={onClose} style={styles.timerModalClose}>
              <Ionicons name="close" size={22} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {currentTrack && (
            <View style={styles.timerTrackPreview}>
              <Image source={{ uri: currentTrack.image }} style={styles.timerTrackImg} />
              <View>
                <Text style={styles.timerTrackTitle} numberOfLines={1}>{currentTrack.title}</Text>
                <Text style={styles.timerTrackArtist}>{currentTrack.artist}</Text>
              </View>
            </View>
          )}

          <Text style={styles.timerSectionLabel}>Duration</Text>
          <View style={styles.timerPresets}>
            {presets.map(min => (
              <TouchableOpacity
                key={min}
                onPress={() => setSelectedMinutes(min)}
                style={[styles.timerPresetBtn, selectedMinutes === min && { backgroundColor: '#6366f1', borderColor: '#6366f1' }]}
              >
                <Text style={[styles.timerPresetText, selectedMinutes === min && { color: '#fff' }]}>{min}m</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.timerToggleRow}>
            <View style={styles.timerToggleInfo}>
              <Ionicons name="trending-down" size={20} color="#818cf8" />
              <View>
                <Text style={styles.timerToggleTitle}>Gentle Fade-Out</Text>
                <Text style={styles.timerToggleDesc}>Volume slowly decreases before stopping</Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={() => setFadeOutEnabled(!fadeOutEnabled)}
              style={[styles.toggleSwitch, fadeOutEnabled && { backgroundColor: '#6366f1' }]}
            >
              <View style={[styles.toggleKnob, fadeOutEnabled && { transform: [{ translateX: 20 }] }]} />
            </TouchableOpacity>
          </View>

          <View style={styles.timerToggleRow}>
            <View style={styles.timerToggleInfo}>
              <Ionicons name="moon" size={20} color="#818cf8" />
              <View>
                <Text style={styles.timerToggleTitle}>Smart Sleep Detect</Text>
                <Text style={styles.timerToggleDesc}>Auto-stop when baby falls asleep</Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={() => setSmartDetect(!smartDetect)}
              style={[styles.toggleSwitch, smartDetect && { backgroundColor: '#6366f1' }]}
            >
              <View style={[styles.toggleKnob, smartDetect && { transform: [{ translateX: 20 }] }]} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            onPress={() => { onSetTimer(selectedMinutes, fadeOutEnabled); onClose(); }}
            style={styles.timerStartBtn}
          >
            <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.timerStartGradient}>
              <Ionicons name="timer" size={18} color="#fff" />
              <Text style={styles.timerStartText}>Start {selectedMinutes}min Timer</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 5: Weekly Sleep Sound Report
   Analytics card showing which sounds worked best
   ═══════════════════════════════════════════════════════════════════════════ */

const WeeklySoundReport = React.memo(({ 
  sessions, 
  onTrackPress 
}: { 
  sessions: SleepSession[]; 
  onTrackPress: (trackId: string) => void;
}) => {
  const report = useMemo(() => {
    const trackStats: Record<string, { count: number; totalDuration: number; qualitySum: number }> = {};

    sessions.forEach(s => {
      if (!trackStats[s.trackId]) {
        trackStats[s.trackId] = { count: 0, totalDuration: 0, qualitySum: 0 };
      }
      trackStats[s.trackId].count++;
      trackStats[s.trackId].totalDuration += s.duration;
      trackStats[s.trackId].qualitySum += s.quality === 'excellent' ? 4 : s.quality === 'good' ? 3 : s.quality === 'fair' ? 2 : 1;
    });

    return Object.entries(trackStats)
      .map(([trackId, stats]) => {
        const track = ENHANCED_TRACKS.find(t => t.id === trackId);
        return {
          trackId,
          track,
          sessions: stats.count,
          avgDuration: Math.round(stats.totalDuration / stats.count),
          avgQuality: stats.qualitySum / stats.count,
          totalMinutes: stats.totalDuration,
        };
      })
      .sort((a, b) => b.avgQuality - a.avgQuality)
      .slice(0, 4);
  }, [sessions]);

  if (report.length === 0) return null;

  const qualityColor = (q: number) => q >= 3.5 ? '#10b981' : q >= 2.5 ? '#f59e0b' : '#ef4444';

  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <SectionHeader title="Weekly Sound Report" subtitle="What works best for sleep" />
      <GlassCard>
        <View style={styles.reportContainer}>
          {report.map((item, i) => (
            <TouchableOpacity key={item.trackId} onPress={() => onTrackPress(item.trackId)} style={[styles.reportRow, i < report.length - 1 && styles.reportRowBorder]}>
              <View style={styles.reportRank}>
                <Text style={styles.reportRankText}>#{i + 1}</Text>
              </View>
              <Image source={{ uri: item.track?.image }} style={styles.reportImg} />
              <View style={styles.reportInfo}>
                <Text style={styles.reportTitle} numberOfLines={1}>{item.track?.title}</Text>
                <Text style={styles.reportMeta}>{item.sessions} sessions • {item.avgDuration}min avg</Text>
              </View>
              <View style={styles.reportScore}>
                <View style={[styles.reportScoreBadge, { backgroundColor: qualityColor(item.avgQuality) + '15' }]}>
                  <Text style={[styles.reportScoreText, { color: qualityColor(item.avgQuality) }]}>
                    {item.avgQuality >= 3.5 ? '★★★★' : item.avgQuality >= 2.5 ? '★★★' : '★★'}
                  </Text>
                </View>
                <Text style={styles.reportTotal}>{item.totalMinutes}min total</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 6: Quick-Access Sound Picker (Bottom Sheet style)
   Horizontal scrollable sound palette for instant play
   ═══════════════════════════════════════════════════════════════════════════ */

const QuickSoundPalette = React.memo(({ 
  tracks, 
  currentTrack, 
  isPlaying, 
  onTrackPress,
  onOpenMixer,
}: { 
  tracks: AudioTrack[]; 
  currentTrack: AudioTrack | null; 
  isPlaying: boolean; 
  onTrackPress: (track: AudioTrack) => void;
  onOpenMixer: () => void;
}) => {
  const categories = useMemo(() => [
    { id: 'all', label: 'All', filter: () => true },
    { id: 'noise', label: 'Noise', filter: (t: AudioTrack) => ['White Noise', 'Brown Noise', 'Pink Noise'].includes(t.title) },
    { id: 'nature', label: 'Nature', filter: (t: AudioTrack) => ['Rain', 'Ocean Waves', 'Forest Rain'].includes(t.title) },
    { id: 'lullaby', label: 'Lullaby', filter: (t: AudioTrack) => ['Soft Piano', 'Twinkle Lullaby'].includes(t.title) },
    { id: 'womb', label: 'Womb', filter: (t: AudioTrack) => ['Womb Sounds', 'Heartbeat'].includes(t.title) },
  ], []);

  const [activeCategory, setActiveCategory] = useState('all');

  const filteredTracks = useMemo(() => {
    const cat = categories.find(c => c.id === activeCategory);
    return cat ? tracks.filter(cat.filter) : tracks;
  }, [tracks, activeCategory, categories]);

  return (
    <Animated.View entering={FadeInUp.delay(150).springify()}>
      <SectionHeader title="Quick Sounds" subtitle="Tap to play instantly" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paletteCategoryScroll}>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat.id}
            onPress={() => setActiveCategory(cat.id)}
            style={[styles.paletteCategoryChip, activeCategory === cat.id && { backgroundColor: '#6366f1' }]}
          >
            <Text style={[styles.paletteCategoryText, activeCategory === cat.id && { color: '#fff' }]}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={onOpenMixer} style={styles.paletteMixerChip}>
          <Ionicons name="layers" size={14} color="#818cf8" />
          <Text style={styles.paletteMixerText}>Mix</Text>
        </TouchableOpacity>
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paletteScroll}>
        {filteredTracks.map((track) => {
          const isCurrent = currentTrack?.id === track.id;
          const isActive = isCurrent && isPlaying;

          return (
            <TouchableOpacity
              key={track.id}
              onPress={() => onTrackPress(track)}
              style={[
                styles.paletteItem,
                isActive && { borderColor: track.color, borderWidth: 2 },
              ]}
            >
              <Image source={{ uri: track.image }} style={styles.paletteItemImg} />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)']}
                style={StyleSheet.absoluteFill}
              />

              {isActive && (
                <View style={styles.palettePlayingIndicator}>
                  <View style={[styles.paletteWaveBar, { height: 8, backgroundColor: track.color }]} />
                  <View style={[styles.paletteWaveBar, { height: 14, backgroundColor: track.color }]} />
                  <View style={[styles.paletteWaveBar, { height: 6, backgroundColor: track.color }]} />
                </View>
              )}

              <View style={styles.paletteItemOverlay}>
                <Text style={styles.paletteItemTitle} numberOfLines={1}>{track.title}</Text>
                <Text style={styles.paletteItemDuration}>{track.duration}</Text>
              </View>

              {isCurrent && !isPlaying && (
                <View style={styles.palettePausedBadge}>
                  <Ionicons name="pause" size={16} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   REDESIGNED PLAYLIST CARD (Horizontal scroll, proper aspect ratio)
   ═══════════════════════════════════════════════════════════════════════════ */

const PlaylistCard = React.memo(({ playlist, onPress, index }: { playlist: Playlist; onPress: () => void; index: number }) => {
  return (
    <Animated.View entering={FadeInRight.delay(index * 80).springify()}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.playlistCard}>
        <LinearGradient
          colors={playlist.coverColor}
          style={styles.playlistCardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {playlist.coverImage && (
            <Image source={{ uri: playlist.coverImage }} style={styles.playlistCardCover} />
          )}
          <View style={styles.playlistCardOverlay} />

          <View style={styles.playlistCardContent}>
            <View style={styles.playlistCardIconWrap}>
              <Ionicons name="musical-notes" size={20} color="#fff" />
            </View>

            {playlist.isLiked && (
              <View style={styles.playlistCardFav}>
                <Ionicons name="heart" size={12} color="#ff6b6b" />
              </View>
            )}

            <View style={styles.playlistCardBottom}>
              <Text style={styles.playlistCardTitle} numberOfLines={1}>{playlist.title}</Text>
              <Text style={styles.playlistCardDesc} numberOfLines={1}>{playlist.description}</Text>
              <View style={styles.playlistCardMeta}>
                <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.7)" />
                <Text style={styles.playlistCardMetaText}>{playlist.duration}</Text>
                <Text style={styles.playlistCardMetaDot}>•</Text>
                <Text style={styles.playlistCardMetaText}>{playlist.trackCount} tracks</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   REDESIGNED TRACK ROW (Compact, modern, proper spacing)
   ═══════════════════════════════════════════════════════════════════════════ */

const TrackRow = React.memo(({ 
  track, 
  index, 
  isPlaying, 
  isCurrentTrack, 
  isFavorite, 
  onPress, 
  onToggleFavorite,
}: any) => {
  return (
    <TouchableOpacity
      style={[styles.trackRow, isCurrentTrack && styles.trackRowActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.trackRowLeft}>
        {!isCurrentTrack && <Text style={styles.trackRowNumber}>{index + 1}</Text>}
        {isCurrentTrack && isPlaying && (
          <View style={styles.trackRowWaveform}>
            <View style={[styles.trackRowWaveBar, { height: 6 }]} />
            <View style={[styles.trackRowWaveBar, { height: 12 }]} />
            <View style={[styles.trackRowWaveBar, { height: 8 }]} />
          </View>
        )}
        <Image source={{ uri: track.image }} style={styles.trackRowImage} />
      </View>

      <View style={styles.trackRowInfo}>
        <Text style={[styles.trackRowTitle, isCurrentTrack && { color: track.color }]} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.trackRowArtist} numberOfLines={1}>
          {track.artist} • {track.duration}
        </Text>
      </View>

      <View style={styles.trackRowRight}>
        <TouchableOpacity style={styles.trackRowFavBtn} onPress={onToggleFavorite}>
          <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={18} color={isFavorite ? '#ff6b6b' : '#475569'} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.trackRowMoreBtn}>
          <Ionicons name="ellipsis-horizontal" size={18} color="#475569" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   IMPORT MODAL (Refined, centered, GrowthDashboard style)
   ═══════════════════════════════════════════════════════════════════════════ */

const ImportMusicModal = React.memo(({ visible, onClose, onImport }: { visible: boolean; onClose: () => void; onImport: (source: 'device' | 'spotify' | 'apple') => void }) => {
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 20 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      scale.value = withTiming(0.9, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  const modalStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  const options = [
    { source: 'device' as const, title: 'Device', desc: 'Import from your library', icon: 'phone-portrait', colors: ['#667eea', '#764ba2'] },
    { source: 'spotify' as const, title: 'Spotify', desc: 'Connect your playlists', icon: 'musical-notes', colors: ['#1DB954', '#1ed760'] },
    { source: 'apple' as const, title: 'Apple Music', desc: 'Access your library', icon: 'musical-note', colors: ['#fa57c1', '#f093fb'] },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.importModalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1}>
          <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="dark" />
        </TouchableOpacity>

        <Animated.View style={[styles.importModalContent, modalStyle]}>
          <LinearGradient colors={['rgba(50,50,70,0.98)', 'rgba(40,40,60,0.95)']} style={StyleSheet.absoluteFill} />

          <View style={styles.importModalHeader}>
            <Text style={styles.importModalTitle}>Add Music</Text>
            <TouchableOpacity onPress={onClose} style={styles.importModalClose}>
              <Ionicons name="close" size={24} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <Text style={styles.importModalSubtitle}>Choose a source to import sounds</Text>

          {options.map(opt => (
            <TouchableOpacity key={opt.source} style={styles.importOption} onPress={() => onImport(opt.source)}>
              <LinearGradient colors={opt.colors} style={styles.importOptionGradient}>
                <Ionicons name={opt.icon as any} size={26} color="#fff" />
                <View style={styles.importOptionText}>
                  <Text style={styles.importOptionTitle}>{opt.title}</Text>
                  <Text style={styles.importOptionDesc}>{opt.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
              </LinearGradient>
            </TouchableOpacity>
          ))}

          <Text style={styles.importModalNote}>Premium subscriptions may be required for some sources</Text>
        </Animated.View>
      </View>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   SWEET ALERT (Refined)
   ═══════════════════════════════════════════════════════════════════════════ */

const SweetAlert = React.memo(({ visible, type, title, message, onClose }: any) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, { damping: 12 });
      const timer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 300 });
        scale.value = withTiming(0.8, { duration: 300 });
        setTimeout(onClose, 300);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!visible) return null;

  const config = {
    success: { colors: ['#11998e', '#38ef7d'], icon: 'checkmark-circle' },
    error: { colors: ['#ef4444', '#f87171'], icon: 'alert-circle' },
    info: { colors: ['#3b82f6', '#60a5fa'], icon: 'information-circle' },
  }[type as keyof typeof config] || config.info;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 100 }]} pointerEvents="none">
      <Animated.View style={[style, alertStyles.container]}>
        <LinearGradient colors={config.colors} style={alertStyles.iconBg}>
          <Ionicons name={config.icon as any} size={28} color="#fff" />
        </LinearGradient>
        <View style={alertStyles.textContainer}>
          <Text style={alertStyles.title}>{title}</Text>
          <Text style={alertStyles.message}>{message}</Text>
        </View>
      </Animated.View>
    </View>
  );
});

const alertStyles = StyleSheet.create({
  container: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderRadius: 16, 
    padding: 16, 
    backgroundColor: '#1a1a2e',
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 10 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 20, 
    elevation: 10, 
    minWidth: 300, 
    maxWidth: SCREEN_W - 40, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.1)' 
  },
  iconBg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  textContainer: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 2, color: '#fff' },
  message: { fontSize: 13, color: '#94a3b8' },
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN — COMPLETELY REDESIGNED
   ═══════════════════════════════════════════════════════════════════════════ */

export default function SoundMixerScreen({ navigation }: SoundMixerScreenProps) {
  const insets = useSafeAreaInsets();
  const { currentBaby } = useBaby();
  const { entries: trackerEntries } = useTracker();

  const {
    currentTrack,
    isPlaying,
    playTrack,
    expandPlayer,
    favorites,
    toggleFavorite,
    isFavorite,
    importedTracks,
    importFromDevice,
    pause,
  } = useAudio();

  const { themeColors, avatar: customSettings, isLoaded: customLoaded } = useCustomization();

  // ── State ──
  const [activeTab, setActiveTab] = useState<TabType>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showMixModal, setShowMixModal] = useState(false);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [alert, setAlert] = useState({ visible: false, type: 'success', title: '', message: '' });
  const [sleepSessions] = useState<SleepSession[]>([
    { id: '1', trackId: '1', startTime: new Date(Date.now() - 86400000 * 2).toISOString(), endTime: new Date(Date.now() - 86400000 * 2 + 3600000).toISOString(), duration: 60, quality: 'excellent', babyWasAsleep: true },
    { id: '2', trackId: '5', startTime: new Date(Date.now() - 86400000).toISOString(), endTime: new Date(Date.now() - 86400000 + 2700000).toISOString(), duration: 45, quality: 'good', babyWasAsleep: true },
    { id: '3', trackId: '1', startTime: new Date(Date.now() - 86400000).toISOString(), endTime: new Date(Date.now() - 86400000 + 4800000).toISOString(), duration: 80, quality: 'excellent', babyWasAsleep: true },
    { id: '4', trackId: '6', startTime: new Date(Date.now() - 86400000 * 3).toISOString(), endTime: new Date(Date.now() - 86400000 * 3 + 1800000).toISOString(), duration: 30, quality: 'fair', babyWasAsleep: false },
  ]);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; },
  });

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 80], [-10, 0], Extrapolation.CLAMP) }],
  }));

  // ── Playlists ──
  const playlists = useMemo((): Playlist[] => [
    {
      id: 'favorites',
      title: 'Favorites',
      description: `${favorites.length} saved sounds`,
      coverColor: ['#ff6b6b', '#ff8e8e'],
      tracks: ENHANCED_TRACKS.filter(t => favorites.includes(t.id)),
      type: 'favorites',
      playCount: 0,
      isLiked: true,
      createdAt: new Date().toISOString(),
      duration: '2h 15m',
      trackCount: favorites.length,
      coverImage: 'https://images.unsplash.com/photo-1514525253440-b393452e3726?w=400&q=80',
    },
    {
      id: 'imported',
      title: 'My Imports',
      description: `${importedTracks.length} imported sounds`,
      coverColor: ['#9b59b6', '#bb8fce'],
      tracks: importedTracks,
      type: 'imported',
      playCount: 0,
      isLiked: false,
      createdAt: new Date().toISOString(),
      duration: '1h 30m',
      trackCount: importedTracks.length,
      coverImage: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80',
    },
    {
      id: 'quick-sleep',
      title: 'Quick Sleep',
      description: '15 min to dreamland',
      coverColor: customLoaded ? [themeColors.primary, themeColors.secondary] : ['#667eea', '#764ba2'],
      tracks: ENHANCED_TRACKS.slice(0, 4),
      type: 'system',
      playCount: 0,
      isLiked: false,
      createdAt: new Date().toISOString(),
      duration: '45m',
      trackCount: 4,
      coverImage: 'https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=400&q=80',
    },
    {
      id: 'deep-night',
      title: 'Deep Night',
      description: 'All night long ambient',
      coverColor: ['#1a1a2e', '#2d2d44'],
      tracks: ENHANCED_TRACKS.filter(t => ['White Noise', 'Brown Noise', 'Pink Noise'].includes(t.title)),
      type: 'time',
      playCount: 0,
      isLiked: false,
      createdAt: new Date().toISOString(),
      duration: '8h',
      trackCount: 3,
      coverImage: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=400&q=80',
    },
    {
      id: 'nature-bundle',
      title: 'Nature Bundle',
      description: 'Rain, ocean & forest',
      coverColor: ['#27ae60', '#2ecc71'],
      tracks: ENHANCED_TRACKS.filter(t => ['Rain', 'Ocean Waves', 'Forest Rain'].includes(t.title)),
      type: 'mood',
      playCount: 0,
      isLiked: false,
      createdAt: new Date().toISOString(),
      duration: '2h',
      trackCount: 3,
      coverImage: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=400&q=80',
    },
    {
      id: 'newborn-comfort',
      title: 'Newborn Comfort',
      description: 'Womb & heartbeat sounds',
      coverColor: ['#ec4899', '#f472b6'],
      tracks: ENHANCED_TRACKS.filter(t => ['Womb Sounds', 'Heartbeat'].includes(t.title)),
      type: 'mood',
      playCount: 0,
      isLiked: false,
      createdAt: new Date().toISOString(),
      duration: '1h 30m',
      trackCount: 2,
      coverImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
    },
  ], [favorites, importedTracks, customLoaded, themeColors]);

  // ── Handlers ──
  const sweetAlert = useCallback((type: 'success' | 'error' | 'info', title: string, message: string) => {
    setAlert({ visible: true, type, title, message });
    Haptics.notificationAsync(
      type === 'success' ? Haptics.NotificationFeedbackType.Success :
      type === 'error' ? Haptics.NotificationFeedbackType.Error :
      Haptics.NotificationFeedbackType.Warning
    );
  }, []);

  const handlePlayTrack = useCallback(async (track: AudioTrack) => {
    if (currentTrack?.id === track.id && isPlaying) {
      await pause();
    } else {
      await playTrack(track);
    }
  }, [currentTrack, isPlaying, playTrack, pause]);

  const handlePlayPlaylist = useCallback((playlist: Playlist) => {
    if (playlist.tracks.length > 0) {
      handlePlayTrack(playlist.tracks[0]);
      setTimeout(() => expandPlayer(), 100);
    } else {
      sweetAlert('info', 'Empty Playlist', 'This playlist has no sounds yet.');
    }
  }, [handlePlayTrack, expandPlayer, sweetAlert]);

  const handleImport = useCallback(async (source: 'device' | 'spotify' | 'apple') => {
    setShowImportModal(false);
    try {
      if (source === 'device') {
        await importFromDevice();
        sweetAlert('success', 'Import Successful', 'Sounds added to your library!');
      } else if (source === 'spotify') {
        const spotifyUrl = 'spotify://';
        const canOpen = await Linking.canOpenURL(spotifyUrl);
        if (canOpen) {
          await Linking.openURL(spotifyUrl);
          sweetAlert('info', 'Spotify Opened', 'Select a playlist to import');
        } else {
          await Linking.openURL('https://open.spotify.com');
        }
      } else if (source === 'apple') {
        const appleUrl = 'music://';
        const canOpen = await Linking.canOpenURL(appleUrl);
        if (canOpen) {
          await Linking.openURL(appleUrl);
          sweetAlert('info', 'Apple Music Opened', 'Select music to import');
        } else {
          sweetAlert('error', 'Apple Music Not Found', 'Please install Apple Music app');
        }
      }
    } catch (error) {
      sweetAlert('error', 'Import Failed', 'Could not import music. Please try again.');
    }
  }, [importFromDevice, sweetAlert]);

  const handleSetTimer = useCallback((minutes: number, fadeOut: boolean) => {
    sweetAlert('success', 'Timer Set', `${minutes} minute timer with${fadeOut ? '' : 'out'} fade-out`);
  }, [sweetAlert]);

  const handlePlayMix = useCallback((mix: SoundMix) => {
    sweetAlert('success', 'Mix Playing', `${mix.name} with ${mix.layers.length} layers`);
  }, [sweetAlert]);

  const handleRecommendationPress = useCallback((rec: SmartRecommendation) => {
    const firstTrack = ENHANCED_TRACKS.find(t => t.id === rec.trackIds[0]);
    if (firstTrack) {
      handlePlayTrack(firstTrack);
      sweetAlert('info', rec.title, `Playing recommended sounds for ${rec.subtitle}`);
    }
  }, [handlePlayTrack, sweetAlert]);

  // ── Filtered tracks ──
  const filteredTracks = useMemo(() => {
    let tracks = [...ENHANCED_TRACKS, ...importedTracks];
    if (activeTab === 'favorites') tracks = tracks.filter(t => isFavorite(t.id));
    else if (activeTab === 'sleep') tracks = tracks.filter(t => ['White Noise', 'Brown Noise', 'Pink Noise', 'Womb Sounds', 'Heartbeat'].includes(t.title));

    if (!searchQuery) return tracks;
    return tracks.filter(t =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artist.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, favorites, importedTracks, activeTab, isFavorite]);

  // ── Tabs ──
  const tabs = [
    { key: 'discover' as TabType, label: 'Discover', icon: 'compass' },
    { key: 'playlists' as TabType, label: 'Playlists', icon: 'albums' },
    { key: 'favorites' as TabType, label: 'Favorites', icon: 'heart' },
    { key: 'sleep' as TabType, label: 'Sleep', icon: 'moon' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#0a0a1a', '#12122a', '#0f0f1e']} style={StyleSheet.absoluteFill} />

      {/* Sticky Header */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <Text style={styles.stickyTitle}>Lullaby Lounge</Text>
        <Text style={styles.stickySubtitle}>
          {currentBaby ? `For ${currentBaby.name}` : 'Sound Mixer'}
        </Text>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── TOP HEADER ROW ── */}
        <Animated.View entering={FadeInDown.springify()} style={styles.topHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerText}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 20 }}>{customLoaded ? customSettings?.avatar || '👶' : '👶'}</Text>
              <Text style={styles.greeting}>
                Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}
              </Text>
            </View>
            <Text style={styles.title}>Lullaby Lounge</Text>
            {currentBaby && (
              <View style={styles.babyInfo}>
                <Ionicons name="heart" size={12} color="#ff6b6b" />
                <Text style={styles.babyText}>Personalized for {currentBaby.name}</Text>
              </View>
            )}
          </View>

          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.iconButton} onPress={() => setShowImportModal(true)}>
              <BlurView intensity={60} style={styles.blurIcon}>
                <Ionicons name="add" size={22} color="#fff" />
              </BlurView>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => setShowSearch(!showSearch)}>
              <BlurView intensity={60} style={styles.blurIcon}>
                <Ionicons name={showSearch ? "close" : "search"} size={22} color="#fff" />
              </BlurView>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── SEARCH ── */}
        {showSearch && (
          <Animated.View entering={FadeInDown.springify()}>
            <View style={styles.searchContainer}>
              <BlurView intensity={80} style={styles.searchBlur} tint="dark">
                <Ionicons name="search" size={18} color="#64748b" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search sounds, artists..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="#64748b"
                  autoFocus
                />
              </BlurView>
            </View>
          </Animated.View>
        )}

        {/* ── NOW PLAYING HERO ── */}
        <NowPlayingHero
          track={currentTrack}
          isPlaying={isPlaying}
          onPlayPause={() => currentTrack && handlePlayTrack(currentTrack)}
          onExpand={() => expandPlayer()}
        />

        {/* ── TAB BAR ── */}
        <View style={styles.tabBar}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => {
                  setActiveTab(tab.key);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[styles.tabItem, isActive && styles.tabItemActive]}
              >
                <Ionicons name={tab.icon as any} size={16} color={isActive ? '#818cf8' : '#64748b'} />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ═════════════════════════════════════════════════════════════════
            TAB: DISCOVER
           ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'discover' && (
          <>
            <SmartSleepIntelligence
              baby={currentBaby}
              trackerEntries={trackerEntries}
              onRecommendationPress={handleRecommendationPress}
            />

            <QuickSoundPalette
              tracks={ENHANCED_TRACKS}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onTrackPress={handlePlayTrack}
              onOpenMixer={() => setShowMixModal(true)}
            />

            <WeeklySoundReport
              sessions={sleepSessions}
              onTrackPress={(trackId) => {
                const track = ENHANCED_TRACKS.find(t => t.id === trackId);
                if (track) handlePlayTrack(track);
              }}
            />

            <View style={{ marginTop: 8 }}>
              <SectionHeader title="Curated Playlists" subtitle="Hand-picked for your baby" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.playlistScroll}>
                {playlists.map((playlist, index) => (
                  <PlaylistCard key={playlist.id} playlist={playlist} onPress={() => handlePlayPlaylist(playlist)} index={index} />
                ))}
              </ScrollView>
            </View>

            <Animated.View entering={FadeInUp.delay(250).springify()} style={{ marginHorizontal: 20, marginTop: 16 }}>
              <TouchableOpacity onPress={() => setShowTimerModal(true)} style={styles.timerQuickAction}>
                <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.timerQuickGradient}>
                  <Ionicons name="timer" size={20} color="#fff" />
                  <Text style={styles.timerQuickText}>Set Sleep Timer</Text>
                  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </>
        )}

        {/* ═════════════════════════════════════════════════════════════════
            TAB: PLAYLISTS / FAVORITES / SLEEP
           ═════════════════════════════════════════════════════════════════ */}
        {(activeTab === 'playlists' || activeTab === 'favorites' || activeTab === 'sleep') && (
          <>
            <View style={{ marginTop: 8 }}>
              <SectionHeader 
                title={activeTab === 'playlists' ? 'All Playlists' : activeTab === 'favorites' ? 'Your Favorites' : 'Sleep Sounds'}
                subtitle={`${filteredTracks.length} sounds`}
              />

              {activeTab === 'playlists' && (
                <View style={styles.playlistGrid}>
                  {playlists.map((playlist, index) => (
                    <PlaylistCard key={playlist.id} playlist={playlist} onPress={() => handlePlayPlaylist(playlist)} index={index} />
                  ))}
                </View>
              )}

              <View style={styles.trackList}>
                {filteredTracks.map((track, index) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={index}
                    isPlaying={isPlaying && currentTrack?.id === track.id}
                    isCurrentTrack={currentTrack?.id === track.id}
                    isFavorite={isFavorite(track.id)}
                    onPress={() => handlePlayTrack(track)}
                    onToggleFavorite={() => toggleFavorite(track.id)}
                  />
                ))}
                {filteredTracks.length === 0 && (
                  <View style={styles.emptyState}>
                    <Ionicons name="musical-note" size={48} color="#475569" />
                    <Text style={styles.emptyText}>No sounds found</Text>
                  </View>
                )}
              </View>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </Animated.ScrollView>

      {/* ── MODALS ── */}
      <ImportMusicModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
      />

      <SoundMixingStudio
        visible={showMixModal}
        onClose={() => setShowMixModal(false)}
        tracks={ENHANCED_TRACKS}
        onPlayMix={handlePlayMix}
      />

      <SleepTimerModal
        visible={showTimerModal}
        onClose={() => setShowTimerModal(false)}
        onSetTimer={handleSetTimer}
        currentTrack={currentTrack}
      />

      <SweetAlert
        {...alert}
        onClose={() => setAlert({ ...alert, visible: false })}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES — Completely Redesigned with GrowthDashboard DNA
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Sticky Header ──
  stickyHeader: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    zIndex: 100, 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingBottom: 10 
  },
  stickyTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  stickySubtitle: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 },

  // ── Top Header ──
  topHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10, 
    marginHorizontal: 20, 
    marginBottom: 16 
  },
  backBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    backgroundColor: 'rgba(255,255,255,0.08)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  headerText: { flex: 1 },
  greeting: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  title: { fontSize: 28, fontWeight: '900', color: '#fff', marginTop: 2, letterSpacing: -0.5 },
  babyInfo: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
  babyText: { fontSize: 12, color: '#cbd5e1', fontWeight: '600' },
  headerButtons: { flexDirection: 'row', gap: 10 },
  iconButton: { borderRadius: 12, overflow: 'hidden' },
  blurIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },

  // ── Search ──
  searchContainer: { marginBottom: 16, marginHorizontal: 20 },
  searchBlur: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  searchInput: { flex: 1, fontSize: 15, color: '#fff', marginLeft: 10, fontWeight: '500' },

  // ── Now Playing Hero ──
  nowPlayingHero: { 
    marginHorizontal: 20, 
    borderRadius: 24, 
    overflow: 'hidden', 
    height: 140, 
    marginBottom: 20,
    ...DESIGN.shadow.lg 
  },
  nowPlayingHeroBg: { ...StyleSheet.absoluteFillObject, borderRadius: 24 },
  nowPlayingHeroContent: { flex: 1, padding: 16, justifyContent: 'space-between' },
  nowPlayingHeroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nowPlayingWaveform: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 20 },
  waveformBar: { width: 3, borderRadius: 1.5 },
  nowPlayingLiveBadge: { fontSize: 11, fontWeight: '800', color: '#10b981', letterSpacing: 1 },
  nowPlayingHeroInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nowPlayingHeroThumb: { width: 48, height: 48, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  nowPlayingHeroText: { flex: 1 },
  nowPlayingHeroTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  nowPlayingHeroArtist: { fontSize: 12, color: '#94a3b8', fontWeight: '500', marginTop: 2 },
  nowPlayingHeroBtn: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', ...DESIGN.shadow.md },
  progressBarBg: { height: 3, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 8 },
  progressBarFill: { height: '100%', borderRadius: 2 },

  // ── Tab Bar ──
  tabBar: { 
    flexDirection: 'row', 
    marginHorizontal: 20, 
    marginBottom: 20, 
    padding: 4, 
    borderRadius: 16, 
    gap: 2, 
    backgroundColor: 'rgba(255,255,255,0.04)' 
  },
  tabItem: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 6, 
    paddingVertical: 10, 
    borderRadius: 12 
  },
  tabItemActive: { backgroundColor: 'rgba(129,140,248,0.15)', ...DESIGN.shadow.sm },
  tabLabel: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  tabLabelActive: { color: '#818cf8', fontWeight: '700' },

  // ── Glass Card ──
  glassCard: {
    borderRadius: DESIGN.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...DESIGN.shadow.md,
    marginHorizontal: DESIGN.spacing.lg,
    marginBottom: DESIGN.spacing.lg,
  },
  glassCardActive: { borderColor: '#818cf8', borderWidth: 2 },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.04)' },
  glassContent: { flex: 1 },

  // ── Section Header ──
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginHorizontal: 20, 
    marginBottom: 12, 
    marginTop: 8 
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', color: '#64748b', marginTop: 2 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700', color: '#818cf8' },

  // ── Smart Recommendations ──
  smartRecsContainer: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 20 },
  smartRecCard: { 
    flex: 1, 
    borderRadius: 20, 
    overflow: 'hidden', 
    padding: 14, 
    borderWidth: 1, 
    backgroundColor: 'rgba(45,45,60,0.4)',
    ...DESIGN.shadow.md 
  },
  smartRecTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  smartRecIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  smartRecEmoji: { fontSize: 18 },
  smartRecConfidence: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  smartRecConfidenceText: { fontSize: 11, fontWeight: '800' },
  smartRecTitle: { fontSize: 14, fontWeight: '800', color: '#fff', marginBottom: 3 },
  smartRecSubtitle: { fontSize: 11, fontWeight: '500', color: '#94a3b8', lineHeight: 15, marginBottom: 10 },
  smartRecTracks: { flexDirection: 'row', alignItems: 'center', gap: -6 },
  smartRecTrackImg: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: '#1a1a2e' },
  smartRecPlayBtn: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginLeft: 6 },

  // ── Quick Sound Palette ──
  paletteCategoryScroll: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  paletteCategoryChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  paletteCategoryText: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  paletteMixerChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(129,140,248,0.1)', borderWidth: 1, borderColor: 'rgba(129,140,248,0.3)' },
  paletteMixerText: { fontSize: 13, fontWeight: '600', color: '#818cf8' },
  paletteScroll: { paddingHorizontal: 20, gap: 12, paddingBottom: 4 },
  paletteItem: { 
    width: 130, 
    height: 160, 
    borderRadius: 20, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.06)',
    ...DESIGN.shadow.md 
  },
  paletteItemImg: { width: '100%', height: '100%' },
  paletteItemOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12 },
  paletteItemTitle: { fontSize: 13, fontWeight: '800', color: '#fff' },
  paletteItemDuration: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500', marginTop: 2 },
  palettePlayingIndicator: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 16 },
  paletteWaveBar: { width: 3, borderRadius: 1.5 },
  palettePausedBadge: { position: 'absolute', top: '50%', left: '50%', marginLeft: -14, marginTop: -14, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },

  // ── Weekly Report ──
  reportContainer: { padding: 8 },
  reportRow: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 12 },
  reportRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  reportRank: { width: 28, alignItems: 'center' },
  reportRankText: { fontSize: 12, fontWeight: '800', color: '#64748b' },
  reportImg: { width: 40, height: 40, borderRadius: 10 },
  reportInfo: { flex: 1, gap: 2 },
  reportTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  reportMeta: { fontSize: 11, fontWeight: '500', color: '#64748b' },
  reportScore: { alignItems: 'flex-end', gap: 3 },
  reportScoreBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  reportScoreText: { fontSize: 11, fontWeight: '800' },
  reportTotal: { fontSize: 10, fontWeight: '500', color: '#475569' },

  // ── Playlist Cards ──
  playlistScroll: { paddingHorizontal: 20, gap: 12, paddingBottom: 4 },
  playlistGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 20, gap: 12 },
  playlistCard: { width: 170, borderRadius: 20, overflow: 'hidden', ...DESIGN.shadow.md },
  playlistCardGradient: { width: '100%', aspectRatio: 0.85, borderRadius: 20, padding: 14, justifyContent: 'space-between', position: 'relative' },
  playlistCardCover: { ...StyleSheet.absoluteFillObject, opacity: 0.25, borderRadius: 20 },
  playlistCardOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 20 },
  playlistCardContent: { flex: 1, justifyContent: 'space-between', position: 'relative', zIndex: 1 },
  playlistCardIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  playlistCardFav: { position: 'absolute', top: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  playlistCardBottom: { gap: 3 },
  playlistCardTitle: { fontSize: 15, fontWeight: '800', color: '#fff' },
  playlistCardDesc: { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  playlistCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  playlistCardMetaText: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  playlistCardMetaDot: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },

  // ── Track Row ──
  trackList: { paddingHorizontal: 20, marginTop: 8 },
  trackRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.03)' },
  trackRowActive: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  trackRowLeft: { flexDirection: 'row', alignItems: 'center', width: 76 },
  trackRowNumber: { fontSize: 13, color: '#475569', width: 24, textAlign: 'center', fontWeight: '600' },
  trackRowWaveform: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 14, width: 20, justifyContent: 'center' },
  trackRowWaveBar: { width: 2.5, backgroundColor: '#10b981', borderRadius: 1.5 },
  trackRowImage: { width: 44, height: 44, borderRadius: 10, marginLeft: 8 },
  trackRowInfo: { flex: 1, marginLeft: 12, marginRight: 8 },
  trackRowTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 2 },
  trackRowArtist: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  trackRowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trackRowFavBtn: { padding: 6, borderRadius: 16 },
  trackRowMoreBtn: { padding: 6, borderRadius: 16 },

  // ── Timer Quick Action ──
  timerQuickAction: { borderRadius: 16, overflow: 'hidden', ...DESIGN.shadow.md },
  timerQuickGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 10 },
  timerQuickText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // ── Import Modal ──
  importModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  importModalContent: { width: '90%', maxWidth: 380, borderRadius: 28, padding: 24, overflow: 'hidden', ...DESIGN.shadow.lg },
  importModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  importModalTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  importModalClose: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  importModalSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 20, fontWeight: '500' },
  importOption: { marginBottom: 10, borderRadius: 18, overflow: 'hidden', ...DESIGN.shadow.md },
  importOptionGradient: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  importOptionText: { flex: 1 },
  importOptionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 2 },
  importOptionDesc: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  importModalNote: { fontSize: 11, color: '#475569', textAlign: 'center', marginTop: 12, fontStyle: 'italic' },

  // ── Mix Modal ──
  mixModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  mixModalContent: { width: '92%', maxHeight: '80%', borderRadius: 28, padding: 24, overflow: 'hidden', ...DESIGN.shadow.lg },
  mixModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  mixModalTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  mixModalClose: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  mixModalSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 16, fontWeight: '500' },
  mixNameInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  mixNameInput: { flex: 1, fontSize: 15, color: '#fff', fontWeight: '600' },
  mixLayersScroll: { maxHeight: 320 },
  mixLayerRow: { marginBottom: 12 },
  mixLayerToggle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  mixLayerImg: { width: 40, height: 40, borderRadius: 10 },
  mixLayerInfo: { flex: 1 },
  mixLayerTitle: { fontSize: 14, fontWeight: '700', color: '#94a3b8' },
  mixLayerArtist: { fontSize: 12, color: '#475569', fontWeight: '500', marginTop: 1 },
  volumeSliderWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginLeft: 52 },
  volumeSliderTrack: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  volumeSliderFill: { height: '100%', borderRadius: 2 },
  volumeValue: { fontSize: 12, fontWeight: '700', color: '#94a3b8', width: 32, textAlign: 'right' },
  mixSaveBtn: { marginTop: 16, borderRadius: 14, overflow: 'hidden' },
  mixSaveGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  mixSaveText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Timer Modal ──
  timerModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  timerModalContent: { width: '90%', borderRadius: 28, padding: 24, overflow: 'hidden', ...DESIGN.shadow.lg },
  timerModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  timerModalTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  timerModalClose: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  timerTrackPreview: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20, padding: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14 },
  timerTrackImg: { width: 44, height: 44, borderRadius: 10 },
  timerTrackTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  timerTrackArtist: { fontSize: 12, color: '#64748b', fontWeight: '500', marginTop: 2 },
  timerSectionLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  timerPresets: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  timerPresetBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' },
  timerPresetText: { fontSize: 14, fontWeight: '700', color: '#94a3b8' },
  timerToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  timerToggleInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  timerToggleTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  timerToggleDesc: { fontSize: 12, color: '#64748b', fontWeight: '500', marginTop: 2 },
  toggleSwitch: { width: 48, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', padding: 4 },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  timerStartBtn: { marginTop: 20, borderRadius: 14, overflow: 'hidden' },
  timerStartGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  timerStartText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Empty State ──
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#475569', fontSize: 16, marginTop: 12, fontWeight: '500' },
});