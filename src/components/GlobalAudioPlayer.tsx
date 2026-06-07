// src/components/GlobalAudioPlayer.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  useColorScheme,
  Image,
  Share,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
  useAnimatedGestureHandler,
  runOnJS,
  FadeIn,
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';
import {
  PanGestureHandler,
  TapGestureHandler,
  PanGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useAudio } from '../context/AudioContext';
import { useSafeApp, useSafeBaby, useSafeAuth, useUnifiedTheme } from '../hooks/useSafeContexts';

const { width, height } = Dimensions.get('window');

// ============================================
// SLEEP TIMER MODAL
// ============================================
const SleepTimerModal = ({ 
  visible, 
  onClose, 
  onSetTimer, 
  currentTimer,
  isDark 
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
    <View style={[StyleSheet.absoluteFill, { zIndex: 1000, justifyContent: 'center', alignItems: 'center' }]} pointerEvents="box-none">
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1}>
        <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>
      
      <Animated.View entering={FadeInUp} style={[styles.timerModal, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
        <Text style={[styles.timerTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Sleep Timer</Text>
        <Text style={styles.timerSubtitle}>Stop playing after...</Text>
        
        {currentTimer.enabled && (
          <View style={styles.activeTimerBadge}>
            <Ionicons name="timer" size={16} color="#fff" />
            <Text style={styles.activeTimerText}>{currentTimer.duration} min active</Text>
            <TouchableOpacity onPress={() => onSetTimer(0)}>
              <Text style={styles.clearTimer}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.timerOptions}>
          {options.map((mins) => (
            <TouchableOpacity 
              key={mins} 
              style={[
                styles.timerOption,
                currentTimer.duration === mins && styles.timerOptionActive
              ]}
              onPress={() => {
                onSetTimer(mins);
                onClose();
              }}
            >
              <Text style={[
                styles.timerOptionText,
                currentTimer.duration === mins && styles.timerOptionTextActive
              ]}>{mins} min</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </View>
  );
};

// ============================================
// FLOATING BALL PLAYER
// ============================================
const FloatingBall = () => {
  const { currentTrack, isPlaying, expandPlayer } = useAudio();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const ballPosition = useSharedValue({ x: width - 80, y: height - 200 });
  
  const panGestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent, { startX: number; startY: number }>({
    onStart: (_, ctx) => {
      ctx.startX = ballPosition.value.x;
      ctx.startY = ballPosition.value.y;
    },
    onActive: (event, ctx) => {
      ballPosition.value = {
        x: ctx.startX + event.translationX,
        y: ctx.startY + event.translationY,
      };
    },
    onEnd: () => {
      const snapX = ballPosition.value.x > width / 2 ? width - 80 : 20;
      ballPosition.value = withSpring({ 
        x: snapX, 
        y: Math.max(100, Math.min(height - 150, ballPosition.value.y)) 
      });
    },
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: ballPosition.value.x },
      { translateY: ballPosition.value.y },
    ],
  }));

  if (!currentTrack) return null;

  return (
    <PanGestureHandler onGestureEvent={panGestureHandler}>
      <Animated.View style={[styles.floatingBallContainer, animatedStyle]}>
        <TapGestureHandler onActivated={() => runOnJS(expandPlayer)()}>
          <Animated.View entering={ZoomIn.springify()}>
            <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={styles.ballBlur}>
              <LinearGradient
                colors={[currentTrack.color, `${currentTrack.color}80`]}
                style={styles.ballGradient}
              >
                <Image source={{ uri: currentTrack.image }} style={styles.ballImage} />
                {isPlaying && (
                  <View style={styles.playingIndicator}>
                    <View style={[styles.dot, { backgroundColor: '#fff' }]} />
                    <View style={[styles.dot, { backgroundColor: '#fff', opacity: 0.6 }]} />
                    <View style={[styles.dot, { backgroundColor: '#fff', opacity: 0.3 }]} />
                  </View>
                )}
              </LinearGradient>
            </BlurView>
          </Animated.View>
        </TapGestureHandler>
      </Animated.View>
    </PanGestureHandler>
  );
};

// ============================================
// MINI PLAYER
// ============================================
const MiniPlayer = () => {
  const { currentTrack, isPlaying, togglePlayback, expandPlayer, collapseToBall, progress } = useAudio();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const slideAnim = useSharedValue(0);
  
  const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
    onActive: (event) => {
      if (event.translationY > 0) slideAnim.value = event.translationY;
    },
    onEnd: (event) => {
      if (event.translationY > 50) runOnJS(collapseToBall)();
      slideAnim.value = withSpring(0);
    },
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideAnim.value }],
    opacity: interpolate(slideAnim.value, [0, 100], [1, 0], Extrapolate.CLAMP),
  }));

  if (!currentTrack) return null;

  return (
    <PanGestureHandler onGestureEvent={gestureHandler}>
      <Animated.View entering={FadeInUp.springify()} style={[styles.miniPlayerContainer, animatedStyle]}>
        <TouchableOpacity onPress={expandPlayer} activeOpacity={0.9} style={styles.miniPlayerTouchable}>
          <BlurView intensity={95} tint={isDark ? 'dark' : 'light'} style={styles.miniPlayerBlur}>
            <LinearGradient
              colors={isDark ? ['rgba(30,30,30,0.95)', 'rgba(20,20,20,0.9)'] : ['rgba(255,255,255,0.95)', 'rgba(248,250,252,0.9)']}
              style={styles.miniPlayerGradient}
            >
              <View style={styles.miniProgressContainer}>
                <View style={[styles.miniProgressBar, { width: `${progress}%`, backgroundColor: currentTrack.color }]} />
              </View>
              
              <View style={styles.miniContent}>
                <Image source={{ uri: currentTrack.image }} style={styles.miniArt} />
                
                <View style={styles.miniTextContainer}>
                  <Text style={[styles.miniTitle, isDark && styles.textDark]} numberOfLines={1}>
                    {currentTrack.title}
                  </Text>
                  <Text style={styles.miniArtist} numberOfLines={1}>
                    {currentTrack.artist}
                  </Text>
                </View>
                
                <View style={styles.miniControls}>
                  <TouchableOpacity onPress={(e) => { e.stopPropagation(); togglePlayback(); }} style={styles.miniPlayButton}>
                    <LinearGradient colors={[currentTrack.color, `${currentTrack.color}80`]} style={styles.miniPlayGradient}>
                      <Ionicons name={isPlaying ? "pause" : "play"} size={20} color="#fff" style={isPlaying ? {} : { marginLeft: 2 }} />
                    </LinearGradient>
                  </TouchableOpacity>
                  
                  <TouchableOpacity onPress={(e) => { e.stopPropagation(); collapseToBall(); }} style={styles.collapseButton}>
                    <Ionicons name="chevron-down" size={20} color={isDark ? '#fff' : '#64748b'} />
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </BlurView>
        </TouchableOpacity>
      </Animated.View>
    </PanGestureHandler>
  );
};

// ============================================
// FULL PLAYER
// ============================================
const FullPlayer = () => {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    togglePlayback,
    nextTrack,
    previousTrack,
    minimizePlayer,
    closePlayer,
    seekTo,
    shuffle,
    isShuffled,
    progress,
    formattedPosition,
    formattedDuration,
    position,
    duration,
    toggleFavorite,
    isFavorite,
    collapseToBall,
    sleepTimer,
    setSleepTimer,
  } = useAudio();
  
  const { currentBaby } = useBaby();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [showTimerModal, setShowTimerModal] = useState(false);
  const slideAnim = useSharedValue(0);
  const translateY = useSharedValue(0);

  React.useEffect(() => {
    slideAnim.value = withSpring(1, { damping: 15, stiffness: 100 });
  }, []);

  const fullGestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
    onActive: (event) => {
      if (event.translationY > 0) translateY.value = event.translationY;
    },
    onEnd: (event) => {
      if (event.translationY > 150) {
        if (event.velocityY > 500) runOnJS(closePlayer)();
        else runOnJS(minimizePlayer)();
        translateY.value = withTiming(0);
      } else {
        translateY.value = withSpring(0);
      }
    },
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(slideAnim.value, [0, 1], [0, 0.9], Extrapolate.CLAMP),
  }));

  const modalStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(slideAnim.value, [0, 1], [height, 0], Extrapolate.CLAMP) + translateY.value },
    ],
  }));

  if (!currentTrack) return null;
  const favorite = isFavorite(currentTrack.id);

  const shareTrack = async (track: any) => {
    try {
      await Share.share({
        message: `Listening to "${track.title}" by ${track.artist} on LittleLoom 🎵`,
      });
    } catch (e) {
      console.error('Share error:', e);
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="box-none">
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={minimizePlayer} activeOpacity={1}>
          <BlurView intensity={90} style={StyleSheet.absoluteFill} tint="dark" />
        </TouchableOpacity>
      </Animated.View>

      <PanGestureHandler onGestureEvent={fullGestureHandler}>
        <Animated.View style={[styles.fullPlayerContainer, modalStyle]}>
          <BlurView intensity={98} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
            <LinearGradient
              colors={isDark ? [currentTrack.color + '20', '#1a1a2e', '#0f0f1e'] : [currentTrack.color + '15', '#f8fafc', '#ffffff']}
              style={StyleSheet.absoluteFill}
            />
          </BlurView>

          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>

          <View style={styles.fullHeader}>
            <TouchableOpacity onPress={minimizePlayer} style={styles.headerButton}>
              <Ionicons name="chevron-down" size={28} color={isDark ? '#fff' : '#1e293b'} />
            </TouchableOpacity>
            
            <Text style={[styles.nowPlayingText, isDark && styles.textDark]}>Now Playing</Text>
            
            <TouchableOpacity 
              onPress={() => toggleFavorite(currentTrack.id)} 
              style={[styles.headerButton, favorite && styles.activeFavoriteButton]}
            >
              <Ionicons name={favorite ? "heart" : "heart-outline"} size={24} color={favorite ? '#ff6b6b' : (isDark ? '#fff' : '#1e293b')} />
            </TouchableOpacity>
          </View>

          <View style={styles.artContainer}>
            <Animated.View entering={FadeIn.delay(100)} style={styles.artWrapper}>
              <View style={[styles.albumArtShadow, { shadowColor: currentTrack.color }]}>
                <Image source={{ uri: currentTrack.image }} style={styles.albumArt} />
              </View>
              {isPlaying && (
                <>
                  <View style={[styles.pulseRing, { borderColor: currentTrack.color + '40' }]} />
                  <View style={[styles.pulseRing2, { borderColor: currentTrack.color + '20' }]} />
                </>
              )}
            </Animated.View>
          </View>

          <View style={styles.trackInfoContainer}>
            <Text style={[styles.fullTitle, isDark && styles.textDark]} numberOfLines={2}>
              {currentTrack.title}
            </Text>
            <Text style={styles.fullArtist}>{currentTrack.artist}</Text>
            {currentBaby && (
              <View style={styles.babyTag}>
                <Ionicons name="heart" size={12} color="#ff6b6b" />
                <Text style={styles.babyTagText}>For {currentBaby.name}</Text>
              </View>
            )}
          </View>

          <View style={styles.progressContainer}>
            <Slider
              value={position}
              minimumValue={0}
              maximumValue={duration || 1}
              onSlidingComplete={(value) => seekTo(value)}
              minimumTrackTintColor={currentTrack.color}
              maximumTrackTintColor={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}
              thumbTintColor={currentTrack.color}
              style={styles.slider}
            />
            <View style={styles.timeContainer}>
              <Text style={[styles.timeText, isDark && styles.textDark]}>{formattedPosition}</Text>
              <Text style={[styles.timeText, isDark && styles.textDark]}>{formattedDuration}</Text>
            </View>
          </View>

          <View style={styles.controlsContainer}>
            <TouchableOpacity onPress={shuffle} style={[styles.controlButton, isShuffled && styles.activeControl]}>
              <Ionicons name="shuffle" size={22} color={isShuffled ? currentTrack.color : isDark ? '#fff' : '#64748b'} />
            </TouchableOpacity>

            <TouchableOpacity onPress={previousTrack} style={styles.controlButton}>
              <Ionicons name="play-skip-back" size={28} color={isDark ? '#fff' : '#1e293b'} />
            </TouchableOpacity>

            <TouchableOpacity onPress={togglePlayback} style={styles.mainPlayButton} disabled={isLoading}>
              <LinearGradient colors={[currentTrack.color, currentTrack.color + '80']} style={styles.mainPlayGradient}>
                {isLoading ? (
                  <Ionicons name="sync" size={32} color="#fff" />
                ) : (
                  <Ionicons name={isPlaying ? "pause" : "play"} size={32} color="#fff" style={isPlaying ? {} : { marginLeft: 4 }} />
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={nextTrack} style={styles.controlButton}>
              <Ionicons name="play-skip-forward" size={28} color={isDark ? '#fff' : '#1e293b'} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => collapseToBall()} style={styles.controlButton}>
              <Ionicons name="ellipse" size={20} color={isDark ? '#fff' : '#64748b'} />
            </TouchableOpacity>
          </View>

          <View style={styles.softActions}>
            <TouchableOpacity style={styles.softButton} onPress={() => setShowTimerModal(true)}>
              <Ionicons name="timer-outline" size={20} color={isDark ? '#fff' : '#64748b'} />
              <Text style={[styles.softButtonText, isDark && styles.textDark]}>
                {sleepTimer.enabled ? `${sleepTimer.duration}m` : 'Timer'}
              </Text>
              {sleepTimer.enabled && <View style={styles.timerDot} />}
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.softButton} onPress={() => shareTrack(currentTrack)}>
              <Ionicons name="share-outline" size={20} color={isDark ? '#fff' : '#64748b'} />
              <Text style={[styles.softButtonText, isDark && styles.textDark]}>Share</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.swipeHintText, isDark && styles.textDark]}>
            Swipe down to minimize • Swipe down fast to close
          </Text>

          <SleepTimerModal 
            visible={showTimerModal}
            onClose={() => setShowTimerModal(false)}
            onSetTimer={setSleepTimer}
            currentTimer={sleepTimer}
            isDark={isDark}
          />
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};

// ============================================
// MAIN EXPORT COMPONENT
// ============================================
export const GlobalAudioPlayer = () => {
  const { playerMode, currentTrack } = useAudio();
  if (!currentTrack) return null;

  return (
    <>
      {playerMode === 'ball' && <FloatingBall />}
      {playerMode === 'mini' && <MiniPlayer />}
      {playerMode === 'full' && <FullPlayer />}
    </>
  );
};

// ✅ FIX: Also export as default for backward compatibility
export default GlobalAudioPlayer;

const styles = StyleSheet.create({
  textDark: { color: '#ffffff' },
  
  // Floating Ball
  floatingBallContainer: { position: 'absolute', zIndex: 999 },
  ballBlur: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 10 },
  ballGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  ballImage: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  playingIndicator: { position: 'absolute', bottom: 4, flexDirection: 'row', gap: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },

  // Mini Player
  miniPlayerContainer: { position: 'absolute', bottom: 90, left: 20, right: 20, zIndex: 998 },
  miniPlayerTouchable: { borderRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 10 },
  miniPlayerBlur: { borderRadius: 24, overflow: 'hidden' },
  miniPlayerGradient: { borderRadius: 24, overflow: 'hidden' },
  miniProgressContainer: { height: 3, backgroundColor: 'rgba(0,0,0,0.05)', width: '100%' },
  miniProgressBar: { height: '100%', borderRadius: 2 },
  miniContent: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingTop: 10 },
  miniArt: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  miniTextContainer: { flex: 1, marginLeft: 12, marginRight: 12 },
  miniTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  miniArtist: { fontSize: 13, color: '#64748b', marginTop: 2 },
  miniControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniPlayButton: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  miniPlayGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  collapseButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(100,116,139,0.1)', alignItems: 'center', justifyContent: 'center' },

  // Full Player
  backdrop: { ...StyleSheet.absoluteFillObject, zIndex: 997 },
  fullPlayerContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, height: height * 0.88, borderTopLeftRadius: 40, borderTopRightRadius: 40, overflow: 'hidden', zIndex: 998 },
  dragHandleContainer: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  dragHandle: { width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(120,120,120,0.3)' },
  fullHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 10, paddingBottom: 10 },
  headerButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(100,116,139,0.1)', alignItems: 'center', justifyContent: 'center' },
  activeFavoriteButton: { backgroundColor: 'rgba(255,107,107,0.15)' },
  nowPlayingText: { fontSize: 16, fontWeight: '600', color: '#64748b', letterSpacing: 0.5 },
  artContainer: { alignItems: 'center', marginTop: 10 },
  artWrapper: { position: 'relative', alignItems: 'center', justifyContent: 'center', width: 300, height: 300 },
  albumArtShadow: { shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.4, shadowRadius: 40, elevation: 20, borderRadius: 32 },
  albumArt: { width: 280, height: 280, borderRadius: 32, borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)' },
  pulseRing: { position: 'absolute', width: 300, height: 300, borderRadius: 150, borderWidth: 2 },
  pulseRing2: { position: 'absolute', width: 340, height: 340, borderRadius: 170, borderWidth: 1 },
  trackInfoContainer: { alignItems: 'center', marginTop: 30, paddingHorizontal: 40 },
  fullTitle: { fontSize: 26, fontWeight: '800', color: '#1e293b', textAlign: 'center', letterSpacing: -0.5 },
  fullArtist: { fontSize: 16, color: '#64748b', marginTop: 8, fontWeight: '500' },
  babyTag: { flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: 'rgba(255,107,107,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  babyTagText: { fontSize: 13, color: '#ff6b6b', fontWeight: '600' },
  progressContainer: { marginTop: 40, paddingHorizontal: 30 },
  slider: { width: '100%', height: 40 },
  timeContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -5, paddingHorizontal: 5 },
  timeText: { fontSize: 13, color: '#64748b', fontWeight: '600', fontVariant: ['tabular-nums'] },
  controlsContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 30, gap: 20 },
  controlButton: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(100,116,139,0.08)' },
  activeControl: { backgroundColor: 'rgba(102,126,234,0.1)' },
  mainPlayButton: { width: 84, height: 84, borderRadius: 42, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  mainPlayGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  softActions: { flexDirection: 'row', justifyContent: 'center', gap: 40, marginTop: 30 },
  softButton: { alignItems: 'center', gap: 6, padding: 10, position: 'relative' },
  softButtonText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  timerDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },
  swipeHintText: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 30, fontWeight: '500' },

  // Timer Modal
  timerModal: { width: width - 60, borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.3, shadowRadius: 40, elevation: 20 },
  timerTitle: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  timerSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 20 },
  activeTimerBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginBottom: 20, gap: 8, alignSelf: 'center' },
  activeTimerText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  clearTimer: { color: '#fff', fontWeight: '700', textDecorationLine: 'underline' },
  timerOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  timerOption: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, backgroundColor: 'rgba(100,116,139,0.1)' },
  timerOptionActive: { backgroundColor: '#667eea' },
  timerOptionText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
  timerOptionTextActive: { color: '#fff' },
});