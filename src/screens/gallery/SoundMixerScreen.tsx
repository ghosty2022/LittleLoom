import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
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
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInRight,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { differenceInMinutes, parseISO } from 'date-fns';

import type { RootStackParamList } from '../../types/navigation';
import { useAudio, AudioTrack, SOUND_TRACKS } from '../../context/AudioContext';
import { useBaby } from '../../context/BabyContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useTracker } from '@/hooks/useTrackerContext';

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Aura
   ═══════════════════════════════════════════════════════════════════════════ */
const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
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
  darkBg: '#0a0812',
  darkSurface: '#15131f',
  darkCard: '#1e1b2b',
  darkBorder: 'rgba(255,255,255,0.06)',
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 40, elevation: 12 },
  },
};

const HEADER_TOP_PADDING = Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 0) + 14;
const HEADER_TOTAL_HEIGHT = HEADER_TOP_PADDING + 52;

const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const HAPTIC_SUCCESS = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

const { width: SCREEN_W } = Dimensions.get('window');

const safeParseDate = (d?: string | null): Date | null => {
  if (!d) return null;
  try {
    return parseISO(d);
  } catch {
    return null;
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */
type SoundMixerScreenProps = NativeStackScreenProps<RootStackParamList, 'SoundMixer'>;
type TabType = 'discover' | 'playlists' | 'favorites' | 'sleep';

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
  type: 'time' | 'mood' | 'sleep-pattern' | 'baby-age' | 'recent';
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
   UI PRIMITIVES
   ═══════════════════════════════════════════════════════════════════════════ */
const GradientText = memo(({ children, style, colors = ['#667eea', '#764ba2', '#f093fb'] }: {
  children: React.ReactNode;
  style?: any;
  colors?: string[];
}) => {
  const raw = typeof children === 'string' ? children : String(children ?? '');
  const letters = raw.split('');
  const interp = (c1: string, c2: string, t: number) => {
    const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
    return `rgb(${Math.round(r1 + (r2 - r1) * t)}, ${Math.round(g1 + (g2 - g1) * t)}, ${Math.round(b1 + (b2 - b1) * t)})`;
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {letters.map((l, i) => {
        const p = i / Math.max(letters.length - 1, 1);
        const ci = p * (colors.length - 1);
        const lo = Math.floor(ci), hi = Math.min(lo + 1, colors.length - 1);
        return <Text key={i} style={[style, { color: interp(colors[lo] || colors[0], colors[hi] || colors[colors.length - 1], ci - lo) }]}>{l}</Text>;
      })}
    </View>
  );
});

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const PressableScale = memo<{
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: any;
  activeScale?: number;
}>(({ children, onPress, disabled, style, activeScale = 0.96 }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedTouchable
      style={[style, anim]}
      onPress={() => { if (!disabled) { HAPTIC_LIGHT(); onPress?.(); } }}
      onPressIn={() => { scale.value = withTiming(activeScale, { duration: 80 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
      activeOpacity={disabled ? 1 : 0.85}
      disabled={disabled}
    >
      {children}
    </AnimatedTouchable>
  );
});

const SectionHeader = memo(({ title, subtitle, icon, color = DS.primaryLight, action, actionLabel, isDark }: {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  action?: () => void;
  actionLabel?: string;
  isDark: boolean;
}) => (
  <View style={styles.sectionHeader}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm }}>
      {icon && (
        <View style={[styles.sectionIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
      )}
      <View>
        <Text style={[styles.sectionTitle, { color: isDark ? DS.white : DS.gray900 }]}>{title}</Text>
        {subtitle && <Text style={[styles.sectionSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>{subtitle}</Text>}
      </View>
    </View>
    {action && (
      <TouchableOpacity onPress={action} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Text style={[styles.sectionActionText, { color }]}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={13} color={color} />
      </TouchableOpacity>
    )}
  </View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   PULSE HEADER — Audio context (replaces hero card)
   ═══════════════════════════════════════════════════════════════════════════ */
const SoundPulse = memo(({
  isDark, currentBaby, currentTrack, isPlaying, stats, onBabyPress, onTimerPress, onImportPress,
}: {
  isDark: boolean;
  currentBaby: any;
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  stats: { tracks: number; favorites: number; sessions: number; imported: number };
  onBabyPress: () => void;
  onTimerPress: () => void;
  onImportPress: () => void;
}) => {
  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);
  const glow = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.06, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1, true);
    rotate.value = withRepeat(withTiming(360, { duration: 9000 }), -1, false);
    glow.value = withRepeat(withSequence(withTiming(0.8, { duration: 1800 }), withTiming(0.4, { duration: 1800 })), -1, true);
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(rotate);
      cancelAnimation(glow);
    };
  }, [pulse, rotate, glow]);

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: pulse.value }] }));

  const statusColor = isPlaying ? DS.success : currentTrack ? DS.warning : DS.primary;
  const statusLabel = currentTrack
    ? isPlaying
      ? `Playing: ${currentTrack.title}`
      : `Paused: ${currentTrack.title}`
    : currentBaby
    ? `Ready for ${currentBaby.name}`
    : 'Tap to pick a sound';

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()}>
      <View style={[styles.pulseWrap, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient
          colors={isDark
            ? ['rgba(99,102,241,0.20)', 'rgba(236,72,153,0.10)', 'rgba(139,92,246,0.05)']
            : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.06)', 'rgba(139,92,246,0.03)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <LinearGradient colors={[`${DS.primary}${isDark ? '45' : '28'}`, 'transparent']}
          style={styles.pulseGlowL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none" />
        <LinearGradient colors={[`${DS.accent}${isDark ? '35' : '22'}`, 'transparent']}
          style={styles.pulseGlowR} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} pointerEvents="none" />

        <View style={styles.pulseRow}>
          <PressableScale onPress={onBabyPress} activeScale={0.94}>
            <View style={styles.pulseAvatarWrap}>
              <Animated.View style={[styles.pulseAvatarGlow, glowStyle]} />
              <Animated.View style={[styles.pulseAvatarRing, ringStyle]}>
                <LinearGradient colors={[DS.primary, DS.accent, DS.warning, DS.primary]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
              <View style={[styles.pulseAvatarInner, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
                {currentTrack?.image ? (
                  <Image source={{ uri: currentTrack.image }} style={styles.pulseAvatarImage} />
                ) : (
                  <Ionicons name="musical-notes" size={22} color={DS.primaryLight} />
                )}
              </View>
            </View>
          </PressableScale>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.pulseName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                {currentBaby?.name ? 'Lullaby Lounge' : 'Sound Mixer'}
              </Text>
              {currentBaby && (
                <View style={[styles.pulseAgePill, { backgroundColor: `${DS.primary}18` }]}>
                  <Text style={[styles.pulseAgeText, { color: DS.primary }]}>{currentBaby.name}</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <View style={[styles.pulseLiveDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.pulseSubText, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
                {statusLabel}
              </Text>
              {isPlaying && (
                <View style={styles.miniWaveform}>
                  {[0.6, 1, 0.5].map((h, i) => (
                    <View key={i} style={[styles.miniWaveBar, { height: 8 * h, backgroundColor: DS.success }]} />
                  ))}
                </View>
              )}
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 6 }}>
            <PressableScale onPress={onTimerPress} activeScale={0.9}>
              <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name="timer-outline" size={18} color={isDark ? DS.gray300 : DS.gray600} />
              </View>
            </PressableScale>
            <PressableScale onPress={onImportPress} activeScale={0.9}>
              <LinearGradient colors={[DS.primary, DS.accent]} style={styles.pulseAddBtn}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="add" size={22} color={DS.white} />
              </LinearGradient>
            </PressableScale>
          </View>
        </View>

        <View style={[styles.pulseStats, { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)' }]}>
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.primaryLight }]}>{stats.tracks}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>tracks</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.danger }]}>{stats.favorites}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>favorites</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.success }]}>{stats.sessions}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>sessions</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.warning }]}>{stats.imported}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>imported</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Aura Ribbon
   ═══════════════════════════════════════════════════════════════════════════ */
const AuraRibbon = memo<{
  isDark: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  text: string;
  onPress?: () => void;
}>(({ isDark, icon, color, label, text, onPress }) => (
  <Animated.View entering={FadeInUp.delay(80).springify()}>
    <PressableScale onPress={onPress} activeScale={0.98}>
      <View style={[styles.ribbon, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={[styles.ribbonIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ribbonLabel, { color }]}>{label}</Text>
          <Text style={[styles.ribbonText, { color: isDark ? DS.gray300 : DS.gray700 }]} numberOfLines={2}>{text}</Text>
        </View>
        {onPress && <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray400} />}
      </View>
    </PressableScale>
  </Animated.View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   Smart Recommendations
   ═══════════════════════════════════════════════════════════════════════════ */
const SmartSleepIntelligence = memo(({
  isDark, baby, trackerEntries, onRecommendationPress,
}: {
  isDark: boolean;
  baby: any;
  trackerEntries: any[];
  onRecommendationPress: (rec: SmartRecommendation) => void;
}) => {
  const recommendations = useMemo((): SmartRecommendation[] => {
    const now = new Date();
    const hour = now.getHours();
    const ageMonths = baby?.birthDate
      ? differenceInMinutes(now, safeParseDate(baby.birthDate) || now) / (30 * 24 * 60)
      : 0;

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
        color: DS.primaryLight,
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
        color: DS.success,
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
        color: DS.accent,
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
        color: DS.warning,
      });
    }

    return recs.slice(0, 2);
  }, [baby, trackerEntries]);

  if (recommendations.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <SectionHeader
        title="Smart Recommendations"
        subtitle="Based on sleep patterns & time"
        icon="sparkles-outline"
        color={DS.accent}
        isDark={isDark}
      />
      <View style={styles.smartRecsContainer}>
        {recommendations.map((rec) => (
          <PressableScale key={rec.id} onPress={() => onRecommendationPress(rec)} activeScale={0.96} style={{ flex: 1 }}>
            <View style={[styles.smartRecCard, { borderColor: `${rec.color}40`, backgroundColor: isDark ? DS.darkCard : DS.white }]}>
              <LinearGradient colors={[`${rec.color}15`, `${rec.color}05`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              <View style={styles.smartRecTop}>
                <View style={[styles.smartRecIconBg, { backgroundColor: `${rec.color}20` }]}>
                  <Text style={styles.smartRecEmoji}>{rec.emoji}</Text>
                </View>
                <View style={[styles.smartRecConfidence, { backgroundColor: `${rec.color}15` }]}>
                  <Text style={[styles.smartRecConfidenceText, { color: rec.color }]}>{rec.confidence}%</Text>
                </View>
              </View>
              <Text style={[styles.smartRecTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{rec.title}</Text>
              <Text style={[styles.smartRecSubtitle, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={2}>{rec.subtitle}</Text>
              <View style={styles.smartRecTracks}>
                {rec.trackIds.slice(0, 3).map((tid, idx) => {
                  const track = ENHANCED_TRACKS.find(t => t.id === tid);
                  return track ? (
                    <Image key={`${rec.id}-img-${idx}`} source={{ uri: track.image }} style={styles.smartRecTrackImg} />
                  ) : null;
                })}
                <View style={[styles.smartRecPlayBtn, { backgroundColor: rec.color }]}>
                  <Ionicons name="play" size={14} color={DS.white} />
                </View>
              </View>
            </View>
          </PressableScale>
        ))}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Now Playing Strip (compact — no big hero)
   ═══════════════════════════════════════════════════════════════════════════ */
const NowPlayingStrip = memo(({
  isDark, track, isPlaying, progress, onPlayPause, onExpand,
}: {
  isDark: boolean;
  track: AudioTrack | null;
  isPlaying: boolean;
  progress: number;
  onPlayPause: () => void;
  onExpand: () => void;
}) => {
  if (!track) return null;
  const color = track.color || DS.primary;

  return (
    <Animated.View entering={FadeInUp.delay(50).springify()}>
      <PressableScale onPress={onExpand} activeScale={0.98}>
        <View style={[styles.nowPlaying, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: `${color}35` }]}>
          <LinearGradient
            colors={[`${color}20`, `${color}05`]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Image source={{ uri: track.image }} style={styles.npImg} blurRadius={0} />
          <View style={styles.npInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.npEyebrow, { color }]}>
                {isPlaying ? 'NOW PLAYING' : 'PAUSED'}
              </Text>
              {isPlaying && (
                <View style={styles.npWave}>
                  {[0.4, 0.9, 0.6].map((h, i) => (
                    <View key={i} style={[styles.npWaveBar, { height: 8 * h, backgroundColor: color }]} />
                  ))}
                </View>
              )}
            </View>
            <Text style={[styles.npTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
              {track.title}
            </Text>
            <Text style={[styles.npArtist, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
              {track.artist}
            </Text>
            <View style={[styles.npProgressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : DS.gray100 }]}>
              <View style={[styles.npProgressFill, { width: `${Math.min(progress * 100, 100)}%`, backgroundColor: color }]} />
            </View>
          </View>
          <TouchableOpacity
            onPress={onPlayPause}
            style={[styles.npPlayBtn, { backgroundColor: color }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color={DS.white} style={!isPlaying ? { marginLeft: 2 } : undefined} />
          </TouchableOpacity>
        </View>
      </PressableScale>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Quick Sound Palette
   ═══════════════════════════════════════════════════════════════════════════ */
const QuickSoundPalette = memo(({
  isDark, tracks, currentTrack, isPlaying, onTrackPress, onOpenMixer,
}: {
  isDark: boolean;
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
      <SectionHeader title="Quick Sounds" subtitle="Tap to play instantly" icon="flash-outline" color={DS.warning} isDark={isDark} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paletteCategoryScroll}>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat.id}
            onPress={() => { setActiveCategory(cat.id); HAPTIC_LIGHT(); }}
            style={[
              styles.paletteCategoryChip,
              {
                backgroundColor: activeCategory === cat.id ? DS.primary : isDark ? 'rgba(255,255,255,0.04)' : DS.white,
                borderColor: activeCategory === cat.id ? DS.primary : isDark ? DS.darkBorder : DS.gray200,
              },
            ]}
            activeOpacity={0.85}
          >
            <Text style={[styles.paletteCategoryText, { color: activeCategory === cat.id ? DS.white : isDark ? DS.gray300 : DS.gray600 }, activeCategory === cat.id && { fontWeight: '700' }]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={onOpenMixer} style={[styles.paletteMixerChip, { borderColor: `${DS.primary}40` }]} activeOpacity={0.85}>
          <Ionicons name="layers" size={14} color={DS.primaryLight} />
          <Text style={styles.paletteMixerText}>Mix</Text>
        </TouchableOpacity>
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.paletteScroll}
        key={`palette-scroll-${activeCategory}`}
      >
        {filteredTracks.map((track, trackIndex) => {
          const isCurrent = currentTrack?.id === track.id;
          const isActive = isCurrent && isPlaying;

          return (
            <PressableScale
              key={`qp-${activeCategory}-${trackIndex}-${track.id}`}
              onPress={() => onTrackPress(track)}
              activeScale={0.94}
            >
              <View style={[styles.paletteItem, { borderColor: isActive ? track.color : isDark ? DS.darkBorder : DS.gray200, borderWidth: isActive ? 2 : 1 }]}>
                <Image source={{ uri: track.image }} style={styles.paletteItemImg} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={StyleSheet.absoluteFill} />

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
                    <Ionicons name="pause" size={16} color={DS.white} />
                  </View>
                )}
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Playlist Card
   ═══════════════════════════════════════════════════════════════════════════ */
const PlaylistCard = memo(({ isDark, playlist, onPress, index }: { isDark: boolean; playlist: any; onPress: () => void; index: number }) => (
  <Animated.View entering={FadeInRight.delay(index * 80).springify()}>
    <PressableScale onPress={onPress} activeScale={0.96}>
      <View style={styles.playlistCard}>
        <LinearGradient
          colors={playlist.coverColor}
          style={styles.playlistCardGradient}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          {playlist.coverImage && <Image source={{ uri: playlist.coverImage }} style={styles.playlistCardCover} />}
          <View style={styles.playlistCardOverlay} />
          <View style={styles.playlistCardContent}>
            <View style={styles.playlistCardIconWrap}>
              <Ionicons name="musical-notes" size={20} color={DS.white} />
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
      </View>
    </PressableScale>
  </Animated.View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   Track Row
   ═══════════════════════════════════════════════════════════════════════════ */
const TrackRow = memo(({ isDark, track, index, isPlaying, isCurrentTrack, isFavorite, onPress, onToggleFavorite }: any) => (
  <PressableScale onPress={onPress} activeScale={0.98}>
    <View style={[
      styles.trackRow,
      {
        backgroundColor: isCurrentTrack
          ? `${track.color}12`
          : isDark ? 'rgba(255,255,255,0.03)' : DS.white,
        borderColor: isCurrentTrack ? `${track.color}40` : isDark ? DS.darkBorder : DS.gray200,
      },
    ]}>
      <View style={styles.trackRowLeft}>
        {!isCurrentTrack && <Text style={[styles.trackRowNumber, { color: isDark ? DS.gray500 : DS.gray400 }]}>{index + 1}</Text>}
        {isCurrentTrack && isPlaying && (
          <View style={styles.trackRowWaveform}>
            <View style={[styles.trackRowWaveBar, { height: 6, backgroundColor: track.color }]} />
            <View style={[styles.trackRowWaveBar, { height: 12, backgroundColor: track.color }]} />
            <View style={[styles.trackRowWaveBar, { height: 8, backgroundColor: track.color }]} />
          </View>
        )}
        <Image source={{ uri: track.image }} style={styles.trackRowImage} />
      </View>
      <View style={styles.trackRowInfo}>
        <Text style={[styles.trackRowTitle, { color: isCurrentTrack ? track.color : isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={[styles.trackRowArtist, { color: isDark ? DS.gray500 : DS.gray400 }]} numberOfLines={1}>
          {track.artist} • {track.duration}
        </Text>
      </View>
      <View style={styles.trackRowRight}>
        <TouchableOpacity style={styles.trackRowFavBtn} onPress={onToggleFavorite}>
          <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={18} color={isFavorite ? '#ff6b6b' : isDark ? DS.gray500 : DS.gray400} />
        </TouchableOpacity>
      </View>
    </View>
  </PressableScale>
));

/* ═══════════════════════════════════════════════════════════════════════════
   Mixing Studio Modal
   ═══════════════════════════════════════════════════════════════════════════ */
const SoundMixingStudio = memo(({
  visible, onClose, tracks, onPlayMix, isDark,
}: {
  visible: boolean;
  onClose: () => void;
  tracks: AudioTrack[];
  onPlayMix: (mix: SoundMix) => void;
  isDark: boolean;
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
    onPlayMix({
      id: `mix-${Date.now()}`,
      name: mixName,
      layers: mixLayers.filter(l => l.isActive),
      createdAt: new Date().toISOString(),
    });
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.mixOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View entering={FadeInUp.springify()} style={[styles.mixModal, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
          <View style={styles.modalHeaderRow}>
            <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900 }]}>Sound Mixer Studio</Text>
            <TouchableOpacity onPress={onClose} style={[styles.modalClose, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
              <Ionicons name="close" size={20} color={isDark ? DS.gray300 : DS.gray600} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.modalSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Layer multiple sounds for a custom experience</Text>

          <View style={[styles.mixNameWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
            <Ionicons name="musical-notes" size={18} color={DS.primaryLight} />
            <TextInput
              style={[styles.mixNameInput, { color: isDark ? DS.white : DS.gray900 }]}
              value={mixName}
              onChangeText={setMixName}
              placeholder="Name your mix..."
              placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
            />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
            {mixLayers.map((layer, i) => {
              const track = tracks.find(t => t.id === layer.trackId);
              if (!track) return null;
              return (
                <View key={`mix-${layer.trackId}-${i}`} style={{ marginBottom: 10 }}>
                  <PressableScale onPress={() => toggleLayer(i)} activeScale={0.98}>
                    <View style={[
                      styles.mixLayer,
                      {
                        backgroundColor: layer.isActive ? `${track.color}15` : isDark ? 'rgba(255,255,255,0.03)' : DS.gray50,
                        borderColor: layer.isActive ? track.color : isDark ? DS.darkBorder : DS.gray200,
                      },
                    ]}>
                      <Image source={{ uri: track.image }} style={styles.mixLayerImg} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.mixLayerTitle, { color: isDark ? DS.white : DS.gray900 }]}>{track.title}</Text>
                        <Text style={[styles.mixLayerArtist, { color: isDark ? DS.gray400 : DS.gray500 }]}>{track.artist}</Text>
                      </View>
                      <Ionicons
                        name={layer.isActive ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={layer.isActive ? track.color : isDark ? DS.gray600 : DS.gray300}
                      />
                    </View>
                  </PressableScale>
                  {layer.isActive && (
                    <View style={styles.volumeRow}>
                      <Ionicons name="volume-low" size={14} color={isDark ? DS.gray500 : DS.gray400} />
                      <View style={[styles.volumeTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : DS.gray100 }]}>
                        <View style={[styles.volumeFill, { width: `${layer.volume * 100}%`, backgroundColor: track.color }]} />
                      </View>
                      <Ionicons name="volume-high" size={14} color={isDark ? DS.gray500 : DS.gray400} />
                      <Text style={[styles.volumeVal, { color: isDark ? DS.gray400 : DS.gray500 }]}>{Math.round(layer.volume * 100)}%</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <PressableScale onPress={handleSaveMix} activeScale={0.97} style={{ marginTop: 16 }}>
            <LinearGradient colors={[DS.primary, DS.accent]} style={styles.mixSaveGrad}>
              <Ionicons name="play" size={18} color={DS.white} />
              <Text style={styles.mixSaveText}>Play Mix</Text>
            </LinearGradient>
          </PressableScale>
        </Animated.View>
      </View>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Sleep Timer Modal
   ═══════════════════════════════════════════════════════════════════════════ */
const SleepTimerModal = memo(({
  visible, onClose, onSetTimer, currentTrack, isDark,
}: {
  visible: boolean;
  onClose: () => void;
  onSetTimer: (minutes: number, fadeOut: boolean) => void;
  currentTrack: AudioTrack | null;
  isDark: boolean;
}) => {
  const [selectedMinutes, setSelectedMinutes] = useState(30);
  const [fadeOutEnabled, setFadeOutEnabled] = useState(true);
  const [smartDetect, setSmartDetect] = useState(true);

  const presets = [15, 30, 45, 60, 90, 120];

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.mixOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View entering={FadeInUp.springify()} style={[styles.timerModal, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
          <View style={styles.modalHeaderRow}>
            <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900 }]}>Sleep Timer</Text>
            <TouchableOpacity onPress={onClose} style={[styles.modalClose, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
              <Ionicons name="close" size={20} color={isDark ? DS.gray300 : DS.gray600} />
            </TouchableOpacity>
          </View>

          {currentTrack && (
            <View style={[styles.timerTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50 }]}>
              <Image source={{ uri: currentTrack.image }} style={styles.timerTrackImg} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.timerTrackTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{currentTrack.title}</Text>
                <Text style={[styles.timerTrackArtist, { color: isDark ? DS.gray400 : DS.gray500 }]}>{currentTrack.artist}</Text>
              </View>
            </View>
          )}

          <Text style={[styles.timerSection, { color: isDark ? DS.gray500 : DS.gray400 }]}>Duration</Text>
          <View style={styles.timerGrid}>
            {presets.map(min => (
              <TouchableOpacity
                key={min}
                onPress={() => setSelectedMinutes(min)}
                style={[
                  styles.timerChip,
                  {
                    backgroundColor: selectedMinutes === min ? DS.primary : isDark ? 'rgba(255,255,255,0.05)' : DS.gray100,
                  },
                ]}
              >
                <Text style={[styles.timerChipText, { color: selectedMinutes === min ? DS.white : isDark ? DS.gray300 : DS.gray700 }]}>
                  {min}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.toggleRow, { borderBottomColor: isDark ? DS.darkBorder : DS.gray200 }]}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="trending-down" size={20} color={DS.primaryLight} />
              <View>
                <Text style={[styles.toggleTitle, { color: isDark ? DS.white : DS.gray900 }]}>Gentle Fade-Out</Text>
                <Text style={[styles.toggleDesc, { color: isDark ? DS.gray500 : DS.gray400 }]}>Volume slowly decreases</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setFadeOutEnabled(!fadeOutEnabled)}
              style={[styles.toggleSwitch, { backgroundColor: fadeOutEnabled ? DS.primary : isDark ? DS.gray700 : DS.gray300 }]}
            >
              <View style={[styles.toggleKnob, fadeOutEnabled && { transform: [{ translateX: 20 }] }]} />
            </TouchableOpacity>
          </View>

          <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="moon" size={20} color={DS.primaryLight} />
              <View>
                <Text style={[styles.toggleTitle, { color: isDark ? DS.white : DS.gray900 }]}>Smart Sleep Detect</Text>
                <Text style={[styles.toggleDesc, { color: isDark ? DS.gray500 : DS.gray400 }]}>Auto-stop when baby sleeps</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setSmartDetect(!smartDetect)}
              style={[styles.toggleSwitch, { backgroundColor: smartDetect ? DS.primary : isDark ? DS.gray700 : DS.gray300 }]}
            >
              <View style={[styles.toggleKnob, smartDetect && { transform: [{ translateX: 20 }] }]} />
            </TouchableOpacity>
          </View>

          <PressableScale onPress={() => { onSetTimer(selectedMinutes, fadeOutEnabled); onClose(); }} activeScale={0.97} style={{ marginTop: 16 }}>
            <LinearGradient colors={[DS.primary, DS.accent]} style={styles.timerStartGrad}>
              <Ionicons name="timer" size={18} color={DS.white} />
              <Text style={styles.timerStartText}>Start {selectedMinutes}min Timer</Text>
            </LinearGradient>
          </PressableScale>
        </Animated.View>
      </View>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Import Music Modal
   ═══════════════════════════════════════════════════════════════════════════ */
const ImportMusicModal = memo(({
  visible, onClose, onImport, isDark,
}: {
  visible: boolean;
  onClose: () => void;
  onImport: (source: 'device' | 'spotify' | 'apple') => void;
  isDark: boolean;
}) => {
  if (!visible) return null;

  const options = [
    { source: 'device' as const, title: 'Device', desc: 'Import from your library', icon: 'phone-portrait', colors: [DS.primary, '#764ba2'] as [string, string] },
    { source: 'spotify' as const, title: 'Spotify', desc: 'Connect your playlists', icon: 'musical-notes', colors: ['#1DB954', '#1ed760'] as [string, string] },
    { source: 'apple' as const, title: 'Apple Music', desc: 'Access your library', icon: 'musical-note', colors: ['#fa57c1', '#f093fb'] as [string, string] },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.mixOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View entering={FadeInUp.springify()} style={[styles.importModal, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
          <View style={styles.modalHeaderRow}>
            <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900 }]}>Add Music</Text>
            <TouchableOpacity onPress={onClose} style={[styles.modalClose, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
              <Ionicons name="close" size={20} color={isDark ? DS.gray300 : DS.gray600} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.modalSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Choose a source to import sounds</Text>

          {options.map(opt => (
            <PressableScale key={opt.source} onPress={() => onImport(opt.source)} activeScale={0.97} style={{ marginBottom: 10 }}>
              <LinearGradient colors={opt.colors} style={styles.importGrad}>
                <Ionicons name={opt.icon as any} size={26} color={DS.white} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.importTitle}>{opt.title}</Text>
                  <Text style={styles.importDesc}>{opt.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
              </LinearGradient>
            </PressableScale>
          ))}

          <Text style={[styles.importNote, { color: isDark ? DS.gray600 : DS.gray400 }]}>
            Premium subscriptions may be required for some sources
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */
export default function SoundMixerScreen({ navigation }: SoundMixerScreenProps) {
  const insets = useSafeAreaInsets();
  const { currentBaby } = useBaby();
  const { entries: trackerEntries } = useTracker();
  const { isDark: isDarkHook, colors } = useCustomization();
  const isDark = !!isDarkHook;

  const {
    currentTrack, isPlaying, playTrack, expandPlayer,
    favorites, toggleFavorite, isFavorite, importedTracks, importFromDevice, pause,
    position, duration,
  } = useAudio();

  const [activeTab, setActiveTab] = useState<TabType>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showMixModal, setShowMixModal] = useState(false);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [alert, setAlert] = useState({ visible: false, type: 'success' as 'success' | 'error' | 'info', title: '', message: '' });

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      'worklet';
      scrollY.value = e.contentOffset.y;
    },
  });
  const headerAnim = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));

  const safeProgress = useMemo(() => {
    const dur = Number(duration) || 0;
    const pos = Number(position) || 0;
    if (dur <= 0) return 0;
    return Math.max(0, Math.min(1, pos / dur));
  }, [position, duration]);

  const sleepSessions = useMemo((): SleepSession[] => [
    { id: '1', trackId: '1', startTime: new Date(Date.now() - 86400000 * 2).toISOString(), endTime: new Date(Date.now() - 86400000 * 2 + 3600000).toISOString(), duration: 60, quality: 'excellent', babyWasAsleep: true },
    { id: '2', trackId: '5', startTime: new Date(Date.now() - 86400000).toISOString(), endTime: new Date(Date.now() - 86400000 + 2700000).toISOString(), duration: 45, quality: 'good', babyWasAsleep: true },
    { id: '3', trackId: '1', startTime: new Date(Date.now() - 86400000).toISOString(), endTime: new Date(Date.now() - 86400000 + 4800000).toISOString(), duration: 80, quality: 'excellent', babyWasAsleep: true },
    { id: '4', trackId: '6', startTime: new Date(Date.now() - 86400000 * 3).toISOString(), endTime: new Date(Date.now() - 86400000 * 3 + 1800000).toISOString(), duration: 30, quality: 'fair', babyWasAsleep: false },
  ], []);

  const playlists = useMemo(() => [
    {
      id: 'favorites',
      title: 'Favorites',
      description: `${favorites.length} saved sounds`,
      coverColor: ['#ff6b6b', '#ff8e8e'] as [string, string],
      tracks: ENHANCED_TRACKS.filter(t => favorites.includes(t.id)),
      type: 'favorites',
      isLiked: true,
      duration: '2h 15m',
      trackCount: favorites.length,
      coverImage: 'https://images.unsplash.com/photo-1514525253440-b393452e3726?w=400&q=80',
    },
    {
      id: 'imported',
      title: 'My Imports',
      description: `${importedTracks.length} imported sounds`,
      coverColor: ['#9b59b6', '#bb8fce'] as [string, string],
      tracks: importedTracks,
      type: 'imported',
      isLiked: false,
      duration: '1h 30m',
      trackCount: importedTracks.length,
      coverImage: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80',
    },
    {
      id: 'quick-sleep',
      title: 'Quick Sleep',
      description: '15 min to dreamland',
      coverColor: [colors?.primary || DS.primary, colors?.secondary || '#764ba2'] as [string, string],
      tracks: ENHANCED_TRACKS.slice(0, 4),
      type: 'system',
      isLiked: false,
      duration: '45m',
      trackCount: 4,
      coverImage: 'https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=400&q=80',
    },
    {
      id: 'deep-night',
      title: 'Deep Night',
      description: 'All night long ambient',
      coverColor: ['#1a1a2e', '#2d2d44'] as [string, string],
      tracks: ENHANCED_TRACKS.filter(t => ['White Noise', 'Brown Noise', 'Pink Noise'].includes(t.title)),
      type: 'time',
      isLiked: false,
      duration: '8h',
      trackCount: 3,
      coverImage: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=400&q=80',
    },
    {
      id: 'nature-bundle',
      title: 'Nature Bundle',
      description: 'Rain, ocean & forest',
      coverColor: ['#27ae60', '#2ecc71'] as [string, string],
      tracks: ENHANCED_TRACKS.filter(t => ['Rain', 'Ocean Waves', 'Forest Rain'].includes(t.title)),
      type: 'mood',
      isLiked: false,
      duration: '2h',
      trackCount: 3,
      coverImage: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=400&q=80',
    },
    {
      id: 'newborn-comfort',
      title: 'Newborn Comfort',
      description: 'Womb & heartbeat sounds',
      coverColor: ['#ec4899', '#f472b6'] as [string, string],
      tracks: ENHANCED_TRACKS.filter(t => ['Womb Sounds', 'Heartbeat'].includes(t.title)),
      type: 'mood',
      isLiked: false,
      duration: '1h 30m',
      trackCount: 2,
      coverImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
    },
  ], [favorites, importedTracks, colors]);

  const sweetAlert = useCallback((type: 'success' | 'error' | 'info', title: string, message: string) => {
    setAlert({ visible: true, type, title, message });
    HAPTICS(type === 'success' ? 'success' : 'light');
  }, []);

  const handlePlayTrack = useCallback(async (track: AudioTrack) => {
    if (currentTrack?.id === track.id && isPlaying) {
      await pause();
    } else {
      await playTrack(track);
    }
  }, [currentTrack, isPlaying, playTrack, pause]);

  const handlePlayPlaylist = useCallback((playlist: any) => {
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
        const canOpen = await Linking.canOpenURL('spotify://');
        if (canOpen) {
          await Linking.openURL('spotify://');
          sweetAlert('info', 'Spotify Opened', 'Select a playlist to import');
        } else {
          await Linking.openURL('https://open.spotify.com');
        }
      } else if (source === 'apple') {
        const canOpen = await Linking.canOpenURL('music://');
        if (canOpen) {
          await Linking.openURL('music://');
          sweetAlert('info', 'Apple Music Opened', 'Select music to import');
        } else {
          sweetAlert('error', 'Apple Music Not Found', 'Please install Apple Music app');
        }
      }
    } catch {
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

  const filteredTracks = useMemo(() => {
    let tracks = [...ENHANCED_TRACKS];
    importedTracks.forEach(t => { if (!tracks.find(et => et.id === t.id)) tracks.push(t); });
    const seen = new Set<string>();
    tracks = tracks.filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true; });

    if (activeTab === 'favorites') tracks = tracks.filter(t => isFavorite(t.id));
    else if (activeTab === 'sleep') tracks = tracks.filter(t => ['White Noise', 'Brown Noise', 'Pink Noise', 'Womb Sounds', 'Heartbeat'].includes(t.title));

    if (!searchQuery) return tracks;
    return tracks.filter(t =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artist.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, favorites, importedTracks, activeTab, isFavorite]);

  const tabs = [
    { key: 'discover' as TabType, label: 'Discover', icon: 'compass' as const },
    { key: 'playlists' as TabType, label: 'Playlists', icon: 'albums' as const },
    { key: 'favorites' as TabType, label: 'Favorites', icon: 'heart' as const },
    { key: 'sleep' as TabType, label: 'Sleep', icon: 'moon' as const },
  ];

  const pulseStats = {
    tracks: ENHANCED_TRACKS.length,
    favorites: favorites.length,
    sessions: sleepSessions.length,
    imported: importedTracks.length,
  };

  const topRibbon = useMemo(() => {
    if (currentTrack && isPlaying) {
      return {
        icon: 'musical-notes-outline' as const,
        color: currentTrack.color || DS.success,
        label: 'Now playing',
        text: `${currentTrack.title} · ${currentTrack.artist}`,
        onPress: () => expandPlayer(),
      };
    }
    const hour = new Date().getHours();
    if (hour >= 19 || hour <= 6) {
      return {
        icon: 'moon-outline' as const,
        color: DS.primaryLight,
        label: 'Bedtime window',
        text: 'Perfect time for white noise · tap to start',
        onPress: () => {
          const bedtime = ENHANCED_TRACKS.find(t => t.title === 'White Noise');
          if (bedtime) handlePlayTrack(bedtime);
        },
      };
    }
    return {
      icon: 'sparkles-outline' as const,
      color: DS.accent,
      label: 'Ready to play',
      text: 'Explore recommended sounds for your baby',
    };
  }, [currentTrack, isPlaying, expandPlayer, handlePlayTrack]);

  const bgColors = isDark
    ? ['#0a0812', '#12102a', '#0a0812']
    : ['#f8faff', '#eef0f5', '#e4e8f0'];

  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={bgColors as [string, string, ...string[]]} style={StyleSheet.absoluteFill} />

      {/* Sticky Header */}
      <Animated.View
        entering={FadeIn.duration(400)}
        style={[
          styles.stickyHeader,
          {
            paddingTop: HEADER_TOP_PADDING,
            backgroundColor: isDark ? 'rgba(10,8,18,0.92)' : 'rgba(255,255,255,0.92)',
            borderBottomColor: isDark ? DS.darkBorder : DS.gray200,
          },
          headerAnim,
        ]}
      >
        <BlurView intensity={isDark ? 90 : 95} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={styles.headerInner}>
          <TouchableOpacity
            onPress={() => { HAPTIC_LIGHT(); navigation.goBack(); }}
            style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
          >
            <Ionicons name="arrow-back" size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.headerTitle}>
              LULLABY LOUNGE
            </GradientText>
            <Text style={[styles.headerSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {currentBaby ? `For ${currentBaby.name}` : 'Sound Mixer'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => { HAPTIC_LIGHT(); setShowSearch(!showSearch); }}
            style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
          >
            <Ionicons name={showSearch ? 'close' : 'search'} size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: HEADER_TOTAL_HEIGHT + 12, paddingBottom: insets.bottom + 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Pulse */}
        <SoundPulse
          isDark={isDark}
          currentBaby={currentBaby}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          stats={pulseStats}
          onBabyPress={() => navigation.navigate('Profile' as any)}
          onTimerPress={() => setShowTimerModal(true)}
          onImportPress={() => setShowImportModal(true)}
        />

        {/* Ribbon */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <AuraRibbon isDark={isDark} {...topRibbon} />
        </View>

        {/* Search */}
        {showSearch && (
          <Animated.View entering={FadeInDown.springify()} style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
            <View style={[styles.searchContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <Ionicons name="search" size={18} color={isDark ? DS.gray500 : DS.gray400} />
              <TextInput
                style={[styles.searchInput, { color: isDark ? DS.white : DS.gray900 }]}
                placeholder="Search sounds, artists..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
                autoFocus
              />
            </View>
          </Animated.View>
        )}

        {/* Now playing strip (compact) */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <NowPlayingStrip
            isDark={isDark}
            track={currentTrack}
            isPlaying={isPlaying}
            progress={safeProgress}
            onPlayPause={() => currentTrack && handlePlayTrack(currentTrack)}
            onExpand={() => expandPlayer()}
          />
        </View>

        {/* Tabs */}
        <View style={{ marginTop: DS.space.md }}>
          <View style={[styles.tabBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }]}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => { setActiveTab(tab.key); HAPTIC_LIGHT(); }}
                  style={[
                    styles.tabItem,
                    isActive && { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : DS.white, ...DS.shadow.sm },
                  ]}
                  activeOpacity={0.85}
                >
                  <Ionicons name={tab.icon} size={15} color={isActive ? DS.primary : isDark ? DS.gray400 : DS.gray500} />
                  <Text style={[styles.tabLabel, { color: isActive ? DS.primary : isDark ? DS.gray400 : DS.gray500 }, isActive && { fontWeight: '700' }]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* DISCOVER */}
        {activeTab === 'discover' && (
          <>
            <View style={{ marginTop: DS.space.lg }}>
              <SmartSleepIntelligence
                isDark={isDark}
                baby={currentBaby}
                trackerEntries={trackerEntries}
                onRecommendationPress={handleRecommendationPress}
              />
            </View>

            <View style={{ marginTop: DS.space.lg }}>
              <QuickSoundPalette
                isDark={isDark}
                tracks={ENHANCED_TRACKS}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onTrackPress={handlePlayTrack}
                onOpenMixer={() => setShowMixModal(true)}
              />
            </View>

            <View style={{ marginTop: DS.space.lg }}>
              <SectionHeader title="Curated Playlists" subtitle="Hand-picked for your baby" icon="albums-outline" color={DS.accent} isDark={isDark} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.playlistScroll}>
                {playlists.map((playlist, index) => (
                  <PlaylistCard key={playlist.id} isDark={isDark} playlist={playlist} onPress={() => handlePlayPlaylist(playlist)} index={index} />
                ))}
              </ScrollView>
            </View>

            <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.lg }}>
              <PressableScale onPress={() => setShowTimerModal(true)} activeScale={0.97}>
                <LinearGradient colors={[DS.primary, DS.accent]} style={styles.timerQuickGradient}>
                  <Ionicons name="timer" size={20} color={DS.white} />
                  <Text style={styles.timerQuickText}>Set Sleep Timer</Text>
                  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
                </LinearGradient>
              </PressableScale>
            </View>
          </>
        )}

        {/* OTHER TABS */}
        {(activeTab === 'playlists' || activeTab === 'favorites' || activeTab === 'sleep') && (
          <>
            <View style={{ marginTop: DS.space.lg }}>
              <SectionHeader
                title={activeTab === 'playlists' ? 'All Playlists' : activeTab === 'favorites' ? 'Your Favorites' : 'Sleep Sounds'}
                subtitle={`${filteredTracks.length} sounds`}
                icon={activeTab === 'playlists' ? 'albums-outline' : activeTab === 'favorites' ? 'heart-outline' : 'moon-outline'}
                color={activeTab === 'playlists' ? DS.accent : activeTab === 'favorites' ? DS.danger : DS.primaryLight}
                isDark={isDark}
              />

              {activeTab === 'playlists' && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.playlistScroll}>
                  {playlists.map((playlist, index) => (
                    <PlaylistCard key={playlist.id} isDark={isDark} playlist={playlist} onPress={() => handlePlayPlaylist(playlist)} index={index} />
                  ))}
                </ScrollView>
              )}

              <View style={{ paddingHorizontal: DS.space.lg, marginTop: 8, gap: 6 }}>
                {filteredTracks.map((track, index) => (
                  <TrackRow
                    key={track.id}
                    isDark={isDark}
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
                    <Ionicons name="musical-note" size={48} color={isDark ? DS.gray600 : DS.gray400} />
                    <Text style={[styles.emptyText, { color: isDark ? DS.gray500 : DS.gray400 }]}>No sounds found</Text>
                  </View>
                )}
              </View>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </Animated.ScrollView>

      {/* Modals */}
      <ImportMusicModal isDark={isDark} visible={showImportModal} onClose={() => setShowImportModal(false)} onImport={handleImport} />
      <SoundMixingStudio isDark={isDark} visible={showMixModal} onClose={() => setShowMixModal(false)} tracks={ENHANCED_TRACKS} onPlayMix={handlePlayMix} />
      <SleepTimerModal isDark={isDark} visible={showTimerModal} onClose={() => setShowTimerModal(false)} onSetTimer={handleSetTimer} currentTrack={currentTrack} />

      {/* Toast */}
      {alert.visible && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999, alignItems: 'center', paddingTop: HEADER_TOTAL_HEIGHT + 12 }]} pointerEvents="none">
          <Animated.View entering={FadeInUp.springify()} style={[styles.toast, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
            <LinearGradient
              colors={alert.type === 'success' ? [DS.success, '#34d399'] : alert.type === 'error' ? [DS.danger, '#f87171'] : [DS.primary, DS.accent]}
              style={styles.toastIcon}
            >
              <Ionicons
                name={alert.type === 'success' ? 'checkmark' : alert.type === 'error' ? 'alert' : 'information'}
                size={20}
                color={DS.white}
              />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toastTitle, { color: isDark ? DS.white : DS.gray900 }]}>{alert.title}</Text>
              <Text style={[styles.toastMsg, { color: isDark ? DS.gray400 : DS.gray500 }]}>{alert.message}</Text>
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const HAPTICS = (type: 'light' | 'success') => {
  if (type === 'success') HAPTIC_SUCCESS();
  else HAPTIC_LIGHT();
};

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Header */
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingBottom: DS.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.lg,
    height: 48,
  },
  headerBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  headerSub: { fontSize: 11, fontWeight: '500', marginTop: -2 },

  /* Pulse */
  pulseWrap: {
    marginHorizontal: DS.space.lg,
    marginTop: DS.space.md,
    borderRadius: DS.radius['2xl'],
    padding: DS.space.lg,
    overflow: 'hidden',
    borderWidth: 1,
    ...DS.shadow.md,
  },
  pulseGlowL: { position: 'absolute', top: -80, left: -60, width: 220, height: 220, borderRadius: 110, opacity: 0.9 },
  pulseGlowR: { position: 'absolute', top: -70, right: -70, width: 200, height: 200, borderRadius: 100, opacity: 0.8 },
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md },
  pulseAvatarWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  pulseAvatarGlow: { position: 'absolute', width: 66, height: 66, borderRadius: 33, backgroundColor: `${DS.primary}35` },
  pulseAvatarRing: { position: 'absolute', width: 62, height: 62, borderRadius: 31, overflow: 'hidden' },
  pulseAvatarInner: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pulseAvatarImage: { width: 54, height: 54, borderRadius: 27 },
  pulseName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, maxWidth: '75%' },
  pulseAgePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  pulseAgeText: { fontSize: 11, fontWeight: '700' },
  pulseLiveDot: { width: 6, height: 6, borderRadius: 3 },
  pulseSubText: { fontSize: 12, fontWeight: '500', flex: 1 },
  miniWaveform: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 10 },
  miniWaveBar: { width: 2.5, borderRadius: 1.5 },
  pulseIconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pulseAddBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  pulseStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm,
    borderRadius: DS.radius.lg,
    marginTop: DS.space.md,
  },
  pulseStat: { alignItems: 'center', flex: 1 },
  pulseStatVal: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  pulseStatLbl: { fontSize: 10, fontWeight: '600', marginTop: 1 },
  pulseStatDiv: { width: 1, height: 22 },

  /* Ribbon */
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    paddingVertical: DS.space.md,
    paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    ...DS.shadow.sm,
  },
  ribbonIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ribbonText: { fontSize: 12, fontWeight: '600', marginTop: 1, lineHeight: 16 },

  /* Section */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: DS.space.lg,
    marginBottom: DS.space.md,
    marginTop: DS.space.sm,
  },
  sectionIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  sectionActionText: { fontSize: 12, fontWeight: '700' },

  /* Search */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: DS.radius.full,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500' },

  /* Now Playing Strip */
  nowPlaying: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: DS.radius.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
    gap: 12,
    ...DS.shadow.sm,
  },
  npImg: { width: 56, height: 56, borderRadius: 12 },
  npInfo: { flex: 1 },
  npEyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  npWave: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 10 },
  npWaveBar: { width: 2.5, borderRadius: 1.5 },
  npTitle: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  npArtist: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  npProgressTrack: { height: 3, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  npProgressFill: { height: '100%', borderRadius: 2 },
  npPlayBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },

  /* Tabs */
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: DS.space.lg,
    padding: 4,
    borderRadius: DS.radius.full,
    gap: 2,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: DS.radius.full,
  },
  tabLabel: { fontSize: 11, fontWeight: '600' },

  /* Smart Recommendations */
  smartRecsContainer: { flexDirection: 'row', gap: 10, marginHorizontal: DS.space.lg, marginBottom: 16 },
  smartRecCard: {
    borderRadius: DS.radius.lg,
    overflow: 'hidden',
    padding: 14,
    borderWidth: 1,
  },
  smartRecTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  smartRecIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  smartRecEmoji: { fontSize: 18 },
  smartRecConfidence: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  smartRecConfidenceText: { fontSize: 11, fontWeight: '800' },
  smartRecTitle: { fontSize: 14, fontWeight: '800', marginBottom: 3 },
  smartRecSubtitle: { fontSize: 11, fontWeight: '500', lineHeight: 15, marginBottom: 10 },
  smartRecTracks: { flexDirection: 'row', alignItems: 'center', gap: -6 },
  smartRecTrackImg: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: DS.darkBg },
  smartRecPlayBtn: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginLeft: 6 },

  /* Palette */
  paletteCategoryScroll: { paddingHorizontal: DS.space.lg, gap: 8, paddingBottom: 12 },
  paletteCategoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: DS.radius.full,
    borderWidth: 1,
  },
  paletteCategoryText: { fontSize: 12, fontWeight: '600' },
  paletteMixerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: DS.radius.full,
    backgroundColor: 'rgba(129,140,248,0.1)',
    borderWidth: 1,
  },
  paletteMixerText: { fontSize: 12, fontWeight: '600', color: DS.primaryLight },
  paletteScroll: { paddingHorizontal: DS.space.lg, gap: 12, paddingBottom: 4 },
  paletteItem: {
    width: 130,
    height: 160,
    borderRadius: DS.radius.lg,
    overflow: 'hidden',
  },
  paletteItemImg: { width: '100%', height: '100%' },
  paletteItemOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12 },
  paletteItemTitle: { fontSize: 13, fontWeight: '800', color: DS.white },
  paletteItemDuration: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500', marginTop: 2 },
  palettePlayingIndicator: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 16 },
  paletteWaveBar: { width: 3, borderRadius: 1.5 },
  palettePausedBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -14,
    marginTop: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Playlists */
  playlistScroll: { paddingHorizontal: DS.space.lg, gap: 12, paddingBottom: 4 },
  playlistCard: { width: 170, borderRadius: DS.radius.lg, overflow: 'hidden' },
  playlistCardGradient: { width: '100%', aspectRatio: 0.85, borderRadius: DS.radius.lg, padding: 14, justifyContent: 'space-between', position: 'relative' },
  playlistCardCover: { ...StyleSheet.absoluteFillObject, opacity: 0.25, borderRadius: DS.radius.lg },
  playlistCardOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: DS.radius.lg },
  playlistCardContent: { flex: 1, justifyContent: 'space-between', position: 'relative', zIndex: 1 },
  playlistCardIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  playlistCardFav: { position: 'absolute', top: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  playlistCardBottom: { gap: 3 },
  playlistCardTitle: { fontSize: 15, fontWeight: '800', color: DS.white },
  playlistCardDesc: { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  playlistCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  playlistCardMetaText: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  playlistCardMetaDot: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },

  /* Track rows */
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: DS.radius.md,
    borderWidth: 1,
  },
  trackRowLeft: { flexDirection: 'row', alignItems: 'center', width: 76 },
  trackRowNumber: { fontSize: 13, width: 24, textAlign: 'center', fontWeight: '600' },
  trackRowWaveform: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 14, width: 20, justifyContent: 'center' },
  trackRowWaveBar: { width: 2.5, borderRadius: 1.5 },
  trackRowImage: { width: 44, height: 44, borderRadius: 10, marginLeft: 8 },
  trackRowInfo: { flex: 1, marginLeft: 12, marginRight: 8 },
  trackRowTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  trackRowArtist: { fontSize: 11, fontWeight: '500' },
  trackRowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trackRowFavBtn: { padding: 6, borderRadius: 16 },

  /* Timer quick action */
  timerQuickGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
    borderRadius: DS.radius.md,
  },
  timerQuickText: { color: DS.white, fontSize: 15, fontWeight: '700' },

  /* Empty */
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, marginTop: 12, fontWeight: '500' },

  /* Mix modal */
  mixOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.55)' },
  mixModal: { width: '92%', maxHeight: '85%', borderRadius: DS.radius['2xl'], padding: 22, ...DS.shadow.lg },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modalTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  modalClose: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalSub: { fontSize: 13, fontWeight: '500', marginBottom: 16 },
  mixNameWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16, borderWidth: 1 },
  mixNameInput: { flex: 1, fontSize: 15, fontWeight: '600' },
  mixLayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  mixLayerImg: { width: 40, height: 40, borderRadius: 10 },
  mixLayerTitle: { fontSize: 13, fontWeight: '700' },
  mixLayerArtist: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  volumeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginLeft: 52 },
  volumeTrack: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  volumeFill: { height: '100%', borderRadius: 2 },
  volumeVal: { fontSize: 12, fontWeight: '700', width: 32, textAlign: 'right' },
  mixSaveGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8, borderRadius: 14 },
  mixSaveText: { color: DS.white, fontSize: 14, fontWeight: '700' },

  /* Timer modal */
  timerModal: { width: '92%', maxWidth: 400, borderRadius: DS.radius['2xl'], padding: 22, ...DS.shadow.lg },
  timerTrack: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, marginBottom: 16 },
  timerTrackImg: { width: 44, height: 44, borderRadius: 10 },
  timerTrackTitle: { fontSize: 14, fontWeight: '700' },
  timerTrackArtist: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  timerSection: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  timerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  timerChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  timerChipText: { fontSize: 13, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
  toggleTitle: { fontSize: 14, fontWeight: '700' },
  toggleDesc: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  toggleSwitch: { width: 48, height: 28, borderRadius: 14, padding: 4 },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: DS.white },
  timerStartGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8, borderRadius: 14 },
  timerStartText: { color: DS.white, fontSize: 15, fontWeight: '700' },

  /* Import */
  importModal: { width: '90%', maxWidth: 380, borderRadius: DS.radius['2xl'], padding: 22, ...DS.shadow.lg },
  importGrad: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14, borderRadius: 16 },
  importTitle: { fontSize: 15, fontWeight: '700', color: DS.white, marginBottom: 2 },
  importDesc: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  importNote: { fontSize: 11, textAlign: 'center', marginTop: 12, fontStyle: 'italic' },

  /* Toast */
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    marginHorizontal: 20,
    ...DS.shadow.lg,
    minWidth: 280,
  },
  toastIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toastTitle: { fontSize: 14, fontWeight: '700' },
  toastMsg: { fontSize: 12, fontWeight: '500', marginTop: 1 },
});