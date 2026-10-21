import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeOut,
  ZoomIn,
  interpolate,
  Extrapolation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAudio } from '../context/AudioContext';
import { useSafeBaby } from '../hooks/useSafeContexts';

const { width, height } = Dimensions.get('window');

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
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.14, shadowRadius: 40, elevation: 12 },
  },
};

const HAPTIC = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
};

const fmtTime = (seconds?: number): string => {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
};

/* ═══════════════════════════════════════════════════════════════════════════
   SAFE AUDIO HOOK — wraps useAudio with guaranteed close/stop actions
   ═══════════════════════════════════════════════════════════════════════════ */
const useSafeAudioControls = () => {
  const audio = useAudio();

  const safeStop = useCallback(async () => {
    HAPTIC.medium();
    try {
      if (typeof (audio as any).stop === 'function') {
        await (audio as any).stop();
      } else if (typeof (audio as any).pause === 'function') {
        await (audio as any).pause();
      }
      if (typeof (audio as any).closePlayer === 'function') {
        (audio as any).closePlayer();
      } else if (typeof (audio as any).collapseToBall === 'function') {
        (audio as any).collapseToBall();
      }
    } catch (e) {
      if (__DEV__) console.warn('[Audio] stop fallback failed:', e);
    }
  }, [audio]);

  const safeClose = useCallback(() => {
    try {
      if (typeof (audio as any).closePlayer === 'function') {
        (audio as any).closePlayer();
      } else if (typeof (audio as any).collapseToBall === 'function') {
        (audio as any).collapseToBall();
      } else if (typeof (audio as any).pause === 'function') {
        (audio as any).pause();
      }
    } catch (e) {
      if (__DEV__) console.warn('[Audio] close fallback failed:', e);
    }
  }, [audio]);

  const safeProgress = useMemo(() => {
    const dur = Number((audio as any).duration) || 0;
    const pos = Number((audio as any).position) || 0;
    if (dur <= 0) return 0;
    return Math.max(0, Math.min(1, pos / dur));
  }, [(audio as any).position, (audio as any).duration]);

  return {
    ...audio,
    safeStop,
    safeClose,
    safeProgress,
    // safe fallbacks so UI never sees undefined
    isPlaying: !!(audio as any).isPlaying,
    isLoading: !!(audio as any).isLoading,
    currentTrack: (audio as any).currentTrack ?? null,
    position: Number((audio as any).position) || 0,
    duration: Number((audio as any).duration) || 0,
    formattedPosition: (audio as any).formattedPosition || fmtTime((audio as any).position),
    formattedDuration: (audio as any).formattedDuration || fmtTime((audio as any).duration),
    isShuffled: !!(audio as any).isShuffled,
    sleepTimer: (audio as any).sleepTimer || { enabled: false, duration: 0 },
    isFavorite: (audio as any).isFavorite || (() => false),
    toggleFavorite: (audio as any).toggleFavorite || (() => {}),
    togglePlayback: (audio as any).togglePlayback || (() => {}),
    playTrack: (audio as any).playTrack || (() => {}),
    pause: (audio as any).pause || (() => {}),
    seekTo: (audio as any).seekTo || (() => {}),
    nextTrack: (audio as any).nextTrack || (() => {}),
    previousTrack: (audio as any).previousTrack || (() => {}),
    shuffle: (audio as any).shuffle || (() => {}),
    setSleepTimer: (audio as any).setSleepTimer || (() => {}),
    minimizePlayer: (audio as any).minimizePlayer || (() => {}),
    expandPlayer: (audio as any).expandPlayer || (() => {}),
    collapseToBall: (audio as any).collapseToBall || (() => {}),
    closePlayer: (audio as any).closePlayer || (() => {}),
    playerMode: (audio as any).playerMode || 'mini',
  };
};

/* ═══════════════════════════════════════════════════════════════════════════
   SLEEP TIMER BOTTOM SHEET
   ═══════════════════════════════════════════════════════════════════════════ */
const SleepTimerSheet = ({
  visible,
  onClose,
  onSetTimer,
  currentTimer,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  onSetTimer: (minutes: number) => void;
  currentTimer: { enabled: boolean; duration: number };
  isDark: boolean;
}) => {
  const options = [15, 30, 45, 60, 90];
  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 2000, justifyContent: 'flex-end' }]} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <BlurView intensity={isDark ? 60 : 40} style={StyleSheet.absoluteFill} tint="dark" />
      </Pressable>

      <Animated.View
        entering={FadeInUp.springify().damping(18)}
        style={[
          styles.sheet,
          { backgroundColor: isDark ? DS.darkCard : DS.white, paddingBottom: 40 },
        ]}
      >
        <View style={[styles.sheetHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' }]} />

        <Text style={[styles.sheetTitle, { color: isDark ? DS.white : DS.gray900 }]}>Sleep Timer</Text>
        <Text style={[styles.sheetSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
          Stop playing after…
        </Text>

        {currentTimer.enabled && (
          <View style={styles.activeTimerRow}>
            <LinearGradient colors={[DS.success, '#34d399']} style={styles.activeTimerBadge}>
              <Ionicons name="timer" size={14} color="#fff" />
              <Text style={styles.activeTimerText}>{currentTimer.duration} min active</Text>
            </LinearGradient>
            <TouchableOpacity onPress={() => { onSetTimer(0); onClose(); }}>
              <Text style={styles.activeTimerClear}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.timerGrid}>
          {options.map((mins) => {
            const active = currentTimer.duration === mins && currentTimer.enabled;
            return (
              <TouchableOpacity
                key={mins}
                style={[
                  styles.timerOption,
                  {
                    backgroundColor: active
                      ? DS.primary
                      : isDark
                      ? 'rgba(255,255,255,0.05)'
                      : DS.gray100,
                  },
                ]}
                onPress={() => {
                  HAPTIC.light();
                  onSetTimer(mins);
                  onClose();
                }}
              >
                <Text
                  style={[
                    styles.timerOptionText,
                    { color: active ? '#fff' : isDark ? DS.gray300 : DS.gray700 },
                  ]}
                >
                  {mins}m
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   FLOATING BALL — drag-snap orb
   ═══════════════════════════════════════════════════════════════════════════ */
const FloatingBall = () => {
  const audio = useSafeAudioControls();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const bx = useSharedValue(width - 84);
  const by = useSharedValue(height - 200);
  const scale = useSharedValue(1);
  const pulse = useSharedValue(1);

  const ctxX = useSharedValue(0);
  const ctxY = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.08, { duration: 1100 }), withTiming(1, { duration: 1100 })),
      -1,
      true
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const pan = Gesture.Pan()
    .onStart(() => {
      ctxX.value = bx.value;
      ctxY.value = by.value;
    })
    .onUpdate((e) => {
      bx.value = ctxX.value + e.translationX;
      by.value = ctxY.value + e.translationY;
    })
    .onEnd(() => {
      const snapX = bx.value > width / 2 ? width - 84 : 16;
      bx.value = withSpring(snapX, { damping: 18, stiffness: 200 });
      by.value = withSpring(Math.max(insets.top + 60, Math.min(height - 180, by.value)), {
        damping: 18,
        stiffness: 200,
      });
    });

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(HAPTIC.light)();
    runOnJS(audio.expandPlayer)();
  });

  const longPress = Gesture.LongPress().onEnd(() => {
    runOnJS(HAPTIC.medium)();
    runOnJS(audio.safeClose)();
  });

  const composed = Gesture.Simultaneous(pan, Gesture.Exclusive(longPress, tap));

  const ballStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bx.value }, { translateY: by.value }, { scale: scale.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: audio.isPlaying ? pulse.value : 1 }],
    opacity: audio.isPlaying ? 1 : 0.6,
  }));

  if (!audio.currentTrack) return null;
  const color = audio.currentTrack.color || DS.primary;

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.ballWrap, ballStyle]}>
        <Animated.View style={[styles.ballAura, { backgroundColor: `${color}45` }, pulseStyle]} />
        <View style={[styles.ballInner, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
          <Image source={{ uri: audio.currentTrack.image }} style={styles.ballImage} />
          {audio.isPlaying && (
            <View style={styles.ballBars}>
              {[0.6, 1, 0.5].map((h, i) => (
                <View key={i} style={[styles.ballBar, { height: 8 * h, backgroundColor: color }]} />
              ))}
            </View>
          )}
          {!audio.isPlaying && (
            <View style={styles.ballPausedBadge}>
              <Ionicons name="play" size={10} color="#fff" style={{ marginLeft: 1 }} />
            </View>
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MINI PLAYER — thin glass bar + stop chip
   ═══════════════════════════════════════════════════════════════════════════ */
const MiniPlayer = () => {
  const audio = useSafeAudioControls();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const translateY = useSharedValue(0);
  const ctxY = useSharedValue(0);

  const pan = Gesture.Pan()
    .onStart(() => {
      ctxY.value = translateY.value;
    })
    .onUpdate((e) => {
      if (e.translationY > 0) translateY.value = ctxY.value + e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > 80 || e.velocityY > 800) {
        runOnJS(HAPTIC.light)();
        runOnJS(audio.safeClose)();
        translateY.value = withSpring(0);
      } else {
        translateY.value = withSpring(0, { damping: 18 });
      }
    });

  const anim = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: interpolate(translateY.value, [0, 140], [1, 0], Extrapolation.CLAMP),
  }));

  if (!audio.currentTrack) return null;
  const color = audio.currentTrack.color || DS.primary;
  const pct = Math.round(audio.safeProgress * 100);

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        entering={FadeInUp.springify().damping(18)}
        style={[styles.miniWrap, { bottom: Math.max(90, insets.bottom + 70) }, anim]}
      >
        <BlurView
          intensity={isDark ? 80 : 60}
          tint={isDark ? 'dark' : 'light'}
          style={[styles.miniBlur, { borderColor: isDark ? DS.darkBorder : 'rgba(0,0,0,0.06)' }]}
        >
          <View style={styles.miniProgressTrack}>
            <View style={[styles.miniProgressFill, { width: `${pct}%`, backgroundColor: color }]} />
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              HAPTIC.light();
              audio.expandPlayer();
            }}
            style={styles.miniRow}
          >
            <Image source={{ uri: audio.currentTrack.image }} style={styles.miniArt} />

            <View style={styles.miniInfo}>
              <Text style={[styles.miniTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                {audio.currentTrack.title}
              </Text>
              <Text style={[styles.miniArtist, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
                {audio.currentTrack.artist}
              </Text>
            </View>

            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                HAPTIC.light();
                audio.togglePlayback();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.miniCtrl, { backgroundColor: color }]}
            >
              {audio.isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons
                  name={audio.isPlaying ? 'pause' : 'play'}
                  size={16}
                  color="#fff"
                  style={!audio.isPlaying ? { marginLeft: 2 } : undefined}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                audio.safeStop();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.miniCtrl, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : DS.gray100 }]}
            >
              <Ionicons name="stop" size={14} color={isDark ? DS.gray300 : DS.gray600} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                HAPTIC.light();
                audio.safeClose();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.miniCtrl, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : DS.gray100 }]}
            >
              <Ionicons name="close" size={14} color={isDark ? DS.gray300 : DS.gray600} />
            </TouchableOpacity>
          </TouchableOpacity>
        </BlurView>
      </Animated.View>
    </GestureDetector>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   AURORA BLOBS — animated atmosphere
   ═══════════════════════════════════════════════════════════════════════════ */
const AuroraBlobs = ({ color }: { color: string }) => {
  const t1 = useSharedValue(0);
  const t2 = useSharedValue(0);
  const t3 = useSharedValue(0);

  useEffect(() => {
    t1.value = withRepeat(withTiming(1, { duration: 9000 }), -1, true);
    t2.value = withRepeat(withTiming(1, { duration: 12000 }), -1, true);
    t3.value = withRepeat(withTiming(1, { duration: 15000 }), -1, true);
    return () => {
      cancelAnimation(t1);
      cancelAnimation(t2);
      cancelAnimation(t3);
    };
  }, [t1, t2, t3]);

  const s1 = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t1.value, [0, 1], [-40, 40]) },
      { translateY: interpolate(t1.value, [0, 1], [-20, 30]) },
      { scale: interpolate(t1.value, [0, 1], [1, 1.15]) },
    ],
    opacity: interpolate(t1.value, [0, 0.5, 1], [0.5, 0.7, 0.5]),
  }));
  const s2 = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t2.value, [0, 1], [30, -30]) },
      { translateY: interpolate(t2.value, [0, 1], [20, -20]) },
      { scale: interpolate(t2.value, [0, 1], [1, 1.2]) },
    ],
    opacity: interpolate(t2.value, [0, 0.5, 1], [0.35, 0.6, 0.35]),
  }));
  const s3 = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t3.value, [0, 1], [0, 60]) },
      { translateY: interpolate(t3.value, [0, 1], [40, -40]) },
      { scale: interpolate(t3.value, [0, 1], [1.1, 0.9]) },
    ],
    opacity: interpolate(t3.value, [0, 0.5, 1], [0.3, 0.5, 0.3]),
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.blob, { backgroundColor: `${color}55`, top: -80, left: -80 }, s1]} />
      <Animated.View style={[styles.blob, { backgroundColor: `${DS.accent}45`, top: height * 0.3, right: -100 }, s2]} />
      <Animated.View style={[styles.blob, { backgroundColor: `${DS.primary}40`, bottom: -100, left: width * 0.2 }, s3]} />
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   WAVEFORM RIBBON — live-reactive bars
   ═══════════════════════════════════════════════════════════════════════════ */
const WaveformRibbon = ({ color, isPlaying }: { color: string; isPlaying: boolean }) => {
  const bars = [0.4, 0.7, 0.5, 0.9, 0.6, 1, 0.55, 0.8, 0.45, 0.75, 0.5, 0.85, 0.4, 0.65, 0.9, 0.5, 0.7];
  return (
    <View style={styles.waveform}>
      {bars.map((h, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveBar,
            {
              height: isPlaying ? 22 * h : 4,
              backgroundColor: isPlaying ? color : 'rgba(255,255,255,0.15)',
              opacity: isPlaying ? 0.9 : 0.5,
            },
          ]}
        />
      ))}
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   FULL PLAYER — no hero card, aurora + vinyl disc
   ═══════════════════════════════════════════════════════════════════════════ */
const FullPlayer = () => {
  const audio = useSafeAudioControls();
  const { currentBaby } = useSafeBaby();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const [showTimer, setShowTimer] = useState(false);

  const open = useSharedValue(0);
  const dragY = useSharedValue(0);

  useEffect(() => {
    open.value = withSpring(1, { damping: 20, stiffness: 140 });
    return () => cancelAnimation(open);
  }, [open]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) dragY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > 160 || e.velocityY > 900) {
        runOnJS(HAPTIC.light)();
        runOnJS(audio.minimizePlayer)();
        dragY.value = withTiming(0, { duration: 200 });
      } else {
        dragY.value = withSpring(0, { damping: 18 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          interpolate(open.value, [0, 1], [height, 0], Extrapolation.CLAMP) + dragY.value,
      },
    ],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(open.value, [0, 1], [0, 1], Extrapolation.CLAMP) * 0.6,
  }));

  const discRotate = useSharedValue(0);
  useEffect(() => {
    if (audio.isPlaying) {
      discRotate.value = withRepeat(withTiming(360, { duration: 14000 }), -1, false);
    } else {
      cancelAnimation(discRotate);
    }
    return () => cancelAnimation(discRotate);
  }, [audio.isPlaying, discRotate]);

  const discStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${discRotate.value}deg` }],
  }));

  if (!audio.currentTrack) return null;
  const track = audio.currentTrack;
  const color = track.color || DS.primary;
  const favorite = audio.isFavorite(track.id);

  const shareTrack = async () => {
    try {
      await Share.share({
        message: `Listening to "${track.title}" by ${track.artist} on LittleLoom 🎧`,
      });
    } catch (e) {
      if (__DEV__) console.warn('share failed', e);
    }
  };

  const maxSeek = audio.duration > 0 ? audio.duration : 1;
  const safePos = Math.max(0, Math.min(audio.position, maxSeek));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <StatusBar barStyle="light-content" />

      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle, { backgroundColor: '#000' }]} pointerEvents="none" />

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.full,
            { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 },
            sheetStyle,
          ]}
        >
          {/* Background */}
          <LinearGradient
            colors={
              isDark
                ? [`${color}25`, '#0a0812', '#0a0812']
                : [`${color}18`, '#f8faff', '#ffffff']
            }
            style={StyleSheet.absoluteFill}
          />
          <AuroraBlobs color={color} />

          {/* Top bar */}
          <View style={styles.fullTop}>
            <TouchableOpacity
              onPress={() => {
                HAPTIC.light();
                audio.minimizePlayer();
              }}
              style={[styles.iconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
            >
              <Ionicons name="chevron-down" size={22} color={isDark ? DS.white : DS.gray800} />
            </TouchableOpacity>

            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[styles.topLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>NOW PLAYING</Text>
              {currentBaby?.name && (
                <Text style={[styles.topSub, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                  for {currentBaby.name}
                </Text>
              )}
            </View>

            <TouchableOpacity
              onPress={() => {
                HAPTIC.light();
                audio.toggleFavorite(track.id);
              }}
              style={[styles.iconBtn, { backgroundColor: favorite ? 'rgba(255,107,107,0.15)' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
            >
              <Ionicons
                name={favorite ? 'heart' : 'heart-outline'}
                size={20}
                color={favorite ? '#ff6b6b' : isDark ? DS.white : DS.gray800}
              />
            </TouchableOpacity>
          </View>

          {/* Vinyl Disc */}
          <View style={styles.discArea}>
            <Animated.View style={[styles.discShadow, { shadowColor: color }]}>
              <View style={[styles.disc, { backgroundColor: isDark ? '#15131f' : '#eef0f5', borderColor: `${color}30` }]}>
                <Animated.View style={[StyleSheet.absoluteFill, discStyle]}>
                  <LinearGradient
                    colors={[`${color}15`, 'transparent', `${color}15`]}
                    style={styles.discRings}
                  />
                  {[1, 2, 3].map((i) => (
                    <View key={i} style={[styles.discRing, { borderColor: `${color}${20 - i * 3}`, transform: [{ scale: 1 - i * 0.15 }] }]} />
                  ))}
                </Animated.View>
                <Image source={{ uri: track.image }} style={styles.discArt} />
              </View>
            </Animated.View>
          </View>

          {/* Waveform */}
          <WaveformRibbon color={color} isPlaying={audio.isPlaying} />

          {/* Track Info */}
          <View style={styles.infoArea}>
            <Text style={[styles.trackTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={2}>
              {track.title}
            </Text>
            <Text style={[styles.trackArtist, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
              {track.artist}
            </Text>
          </View>

          {/* Progress */}
          <View style={styles.progressWrap}>
            <Slider
              value={safePos}
              minimumValue={0}
              maximumValue={maxSeek}
              onSlidingComplete={(v) => {
                HAPTIC.light();
                try {
                  audio.seekTo(v);
                } catch (e) {
                  if (__DEV__) console.warn('seek failed', e);
                }
              }}
              minimumTrackTintColor={color}
              maximumTrackTintColor={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}
              thumbTintColor={color}
              style={styles.slider}
            />
            <View style={styles.timeRow}>
              <Text style={[styles.timeText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                {fmtTime(safePos)}
              </Text>
              <Text style={[styles.timeText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                {fmtTime(maxSeek)}
              </Text>
            </View>
          </View>

          {/* Control dock */}
          <View
            style={[
              styles.dock,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)',
                borderColor: isDark ? DS.darkBorder : 'rgba(0,0,0,0.06)',
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => {
                HAPTIC.light();
                audio.shuffle();
              }}
              style={styles.dockBtn}
            >
              <Ionicons
                name="shuffle"
                size={20}
                color={audio.isShuffled ? color : isDark ? DS.gray400 : DS.gray500}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                HAPTIC.light();
                audio.previousTrack();
              }}
              style={styles.dockBtn}
            >
              <Ionicons name="play-skip-back" size={24} color={isDark ? DS.white : DS.gray900} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                HAPTIC.medium();
                audio.togglePlayback();
              }}
              style={[styles.playMain, { backgroundColor: color, shadowColor: color }]}
              disabled={audio.isLoading}
            >
              {audio.isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons
                  name={audio.isPlaying ? 'pause' : 'play'}
                  size={28}
                  color="#fff"
                  style={!audio.isPlaying ? { marginLeft: 3 } : undefined}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                HAPTIC.light();
                audio.nextTrack();
              }}
              style={styles.dockBtn}
            >
              <Ionicons name="play-skip-forward" size={24} color={isDark ? DS.white : DS.gray900} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => audio.safeStop()}
              style={styles.dockBtn}
            >
              <Ionicons name="stop-circle-outline" size={22} color={isDark ? DS.gray400 : DS.gray500} />
            </TouchableOpacity>
          </View>

          {/* Bottom actions */}
          <View style={styles.bottomRow}>
            <TouchableOpacity onPress={() => setShowTimer(true)} style={styles.bottomBtn}>
              <Ionicons name="timer-outline" size={20} color={isDark ? DS.gray300 : DS.gray600} />
              <Text style={[styles.bottomBtnText, { color: isDark ? DS.gray300 : DS.gray600 }]}>
                {audio.sleepTimer.enabled ? `${audio.sleepTimer.duration}m` : 'Timer'}
              </Text>
              {audio.sleepTimer.enabled && <View style={styles.bottomDot} />}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => audio.collapseToBall()} style={styles.bottomBtn}>
              <Ionicons name="ellipse-outline" size={20} color={isDark ? DS.gray300 : DS.gray600} />
              <Text style={[styles.bottomBtnText, { color: isDark ? DS.gray300 : DS.gray600 }]}>
                Ball
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={shareTrack} style={styles.bottomBtn}>
              <Ionicons name="share-outline" size={20} color={isDark ? DS.gray300 : DS.gray600} />
              <Text style={[styles.bottomBtnText, { color: isDark ? DS.gray300 : DS.gray600 }]}>
                Share
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={audio.safeClose}
            style={styles.stopFullBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="power" size={14} color={DS.danger} />
            <Text style={styles.stopFullText}>Stop & close player</Text>
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>

      <SleepTimerSheet
        visible={showTimer}
        onClose={() => setShowTimer(false)}
        onSetTimer={audio.setSleepTimer}
        currentTimer={audio.sleepTimer}
        isDark={isDark}
      />
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   ROOT
   ═══════════════════════════════════════════════════════════════════════════ */
export const GlobalAudioPlayer = () => {
  const audio = useSafeAudioControls();

  if (!audio.currentTrack) return null;

  return (
    <>
      {audio.playerMode === 'ball' && <FloatingBall />}
      {audio.playerMode === 'mini' && <MiniPlayer />}
      {audio.playerMode === 'full' && <FullPlayer />}
    </>
  );
};

export default GlobalAudioPlayer;

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  /* Floating Ball */
  ballWrap: {
    position: 'absolute',
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 998,
  },
  ballAura: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  ballInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    ...DS.shadow.lg,
  },
  ballImage: { width: 52, height: 52, borderRadius: 26 },
  ballBars: {
    position: 'absolute',
    bottom: 2,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  ballBar: { width: 2.5, borderRadius: 1.5 },
  ballPausedBadge: {
    position: 'absolute',
    bottom: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Mini */
  miniWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 997,
    ...DS.shadow.lg,
  },
  miniBlur: {
    borderRadius: DS.radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
  },
  miniProgressTrack: { height: 3, backgroundColor: 'rgba(0,0,0,0.06)' },
  miniProgressFill: { height: '100%' },
  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  miniArt: { width: 42, height: 42, borderRadius: 10 },
  miniInfo: { flex: 1 },
  miniTitle: { fontSize: 14, fontWeight: '700' },
  miniArtist: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  miniCtrl: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Full Player */
  full: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    overflow: 'hidden',
  },
  fullTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DS.space.lg,
    gap: 12,
  },
  topLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  topSub: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  blob: {
    position: 'absolute',
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: width * 0.45,
  },

  discArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: DS.space.lg,
  },
  discShadow: {
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.45,
    shadowRadius: 50,
    elevation: 20,
  },
  disc: {
    width: width * 0.72,
    height: width * 0.72,
    borderRadius: width * 0.36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  discRings: { ...StyleSheet.absoluteFill, borderRadius: 999 },
  discRing: {
    position: 'absolute',
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: width * 0.35,
    borderWidth: 1,
  },
  discArt: {
    width: width * 0.55,
    height: width * 0.55,
    borderRadius: width * 0.275,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.15)',
  },

  waveform: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
    height: 26,
    marginBottom: DS.space.md,
  },
  waveBar: { width: 3, borderRadius: 1.5 },

  infoArea: {
    alignItems: 'center',
    paddingHorizontal: DS.space['2xl'],
    marginBottom: DS.space.md,
  },
  trackTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  trackArtist: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },

  progressWrap: {
    paddingHorizontal: DS.space['2xl'],
    marginBottom: DS.space.sm,
  },
  slider: { width: '100%', height: 36 },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
    paddingHorizontal: 4,
  },
  timeText: { fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },

  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginHorizontal: DS.space['2xl'],
    marginTop: DS.space.md,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: DS.radius['2xl'],
    borderWidth: 1,
  },
  dockBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playMain: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },

  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: DS.space['2xl'],
    marginTop: DS.space.lg,
  },
  bottomBtn: {
    alignItems: 'center',
    gap: 4,
    padding: 6,
    position: 'relative',
  },
  bottomBtnText: { fontSize: 10, fontWeight: '600' },
  bottomDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: DS.success,
  },

  stopFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: DS.space.md,
    paddingVertical: 8,
  },
  stopFullText: { fontSize: 12, fontWeight: '600', color: DS.danger },

  /* Sleep Timer Sheet */
  sheet: {
    padding: DS.space['2xl'],
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: DS.space.lg,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sheetSub: { fontSize: 13, fontWeight: '500', marginTop: 4, marginBottom: DS.space.lg },
  activeTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: DS.space.md,
  },
  activeTimerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  activeTimerText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  activeTimerClear: { color: DS.danger, fontSize: 12, fontWeight: '700' },
  timerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timerOption: {
    flexBasis: '30%',
    flexGrow: 1,
    paddingVertical: 14,
    borderRadius: DS.radius.md,
    alignItems: 'center',
  },
  timerOptionText: { fontSize: 14, fontWeight: '700' },
});