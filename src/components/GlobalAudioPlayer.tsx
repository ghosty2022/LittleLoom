import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  useColorScheme,
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
  SlideInUp,
} from 'react-native-reanimated';
import {
  PanGestureHandler,
  GestureHandlerRootView,
  PanGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useAudio } from '../context/AudioContext';

const { width, height } = Dimensions.get('window');

// Mini Player (FAB style)
const MiniPlayer = () => {
  const { currentTrack, isPlaying, togglePlayback, expandPlayer, progress } = useAudio();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Swipe to dismiss mini player
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const { closePlayer } = useAudio();

  const miniGestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
    onActive: (event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    },
    onEnd: (event) => {
      // If swiped far enough left/right or down, close the player
      if (Math.abs(event.translationX) > 100 || event.translationY > 100) {
        runOnJS(closePlayer)();
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
      } else {
        // Spring back to original position
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    },
  });

  const miniAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  if (!currentTrack) return null;

  return (
    <PanGestureHandler onGestureEvent={miniGestureHandler}>
      <Animated.View entering={SlideInUp.springify()} style={[styles.miniPlayerContainer, miniAnimatedStyle]}>
        <TouchableOpacity onPress={expandPlayer} activeOpacity={0.9}>
          <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={styles.miniPlayerBlur}>
            <LinearGradient
              colors={isDark ? ['rgba(30,30,30,0.95)', 'rgba(20,20,20,0.9)'] : ['rgba(255,255,255,0.95)', 'rgba(248,250,252,0.9)']}
              style={styles.miniPlayerGradient}
            >
              <View style={styles.miniProgressContainer}>
                <View style={[styles.miniProgressBar, { width: `${progress}%`, backgroundColor: currentTrack.color }]} />
              </View>
              
              <View style={styles.miniContent}>
                <View style={[styles.miniArt, { backgroundColor: currentTrack.color }]}>
                  <Ionicons name="musical-note" size={20} color="#fff" />
                </View>
                
                <View style={styles.miniTextContainer}>
                  <Text style={[styles.miniTitle, isDark && styles.textDark]} numberOfLines={1}>
                    {currentTrack.title}
                  </Text>
                  <Text style={styles.miniArtist} numberOfLines={1}>
                    {currentTrack.artist}
                  </Text>
                </View>
                
                <TouchableOpacity 
                  onPress={(e) => {
                    e.stopPropagation();
                    togglePlayback();
                  }}
                  style={styles.miniPlayButton}
                >
                  <LinearGradient
                    colors={[currentTrack.color, currentTrack.color + '80']}
                    style={styles.miniPlayGradient}
                  >
                    <Ionicons 
                      name={isPlaying ? "pause" : "play"} 
                      size={20} 
                      color="#fff" 
                      style={isPlaying ? {} : { marginLeft: 2 }}
                    />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
              
              {/* Swipe hint */}
              <View style={styles.swipeHint}>
                <View style={styles.swipeLine} />
              </View>
            </LinearGradient>
          </BlurView>
        </TouchableOpacity>
      </Animated.View>
    </PanGestureHandler>
  );
};

// Full Player Modal with swipe to dismiss
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
    queue,
    playTrack,
    currentIndex,  // FIXED: Now properly imported from context
  } = useAudio();
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const slideAnim = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  React.useEffect(() => {
    slideAnim.value = withSpring(1, { damping: 15, stiffness: 100 });
  }, []);

  // Swipe to dismiss full player
  const fullGestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
    onActive: (event) => {
      // Only allow swiping down
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    },
    onEnd: (event) => {
      // If swiped down far enough, minimize or close
      if (event.translationY > 150) {
        if (event.velocityY > 500) {
          // Fast swipe down - close completely
          runOnJS(closePlayer)();
        } else {
          // Slow swipe down - minimize to mini player
          runOnJS(minimizePlayer)();
        }
        translateY.value = withTiming(0);
      } else {
        // Spring back up
        translateY.value = withSpring(0);
      }
    },
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(slideAnim.value, [0, 1], [0, 0.8], Extrapolate.CLAMP),
  }));

  const modalStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(slideAnim.value, [0, 1], [height, 0], Extrapolate.CLAMP) + translateY.value },
    ],
  }));

  if (!currentTrack) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={minimizePlayer} activeOpacity={1}>
          <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="dark" />
        </TouchableOpacity>
      </Animated.View>

      <PanGestureHandler onGestureEvent={fullGestureHandler}>
        <Animated.View style={[styles.fullPlayerContainer, modalStyle]}>
          <BlurView intensity={95} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
            <LinearGradient
              colors={isDark ? ['#1a1a2e', '#16213e', '#0f3460'] : ['#f8fafc', '#e2e8f0', '#dbeafe']}
              style={StyleSheet.absoluteFill}
            />
          </BlurView>

          {/* Drag Handle */}
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header */}
          <View style={styles.fullHeader}>
            <TouchableOpacity onPress={minimizePlayer} style={styles.headerButton}>
              <Ionicons name="chevron-down" size={28} color={isDark ? '#fff' : '#1e293b'} />
            </TouchableOpacity>
            
            <Text style={[styles.nowPlayingText, isDark && styles.textDark]}>Now Playing</Text>
            
            <TouchableOpacity onPress={closePlayer} style={styles.headerButton}>
              <Ionicons name="close" size={24} color="#ef4444" />
            </TouchableOpacity>
          </View>

          {/* Album Art */}
          <View style={styles.artContainer}>
            <Animated.View entering={FadeIn.delay(100)} style={styles.artWrapper}>
              <LinearGradient
                colors={[currentTrack.color, currentTrack.color + '60']}
                style={styles.albumArt}
              >
                <Ionicons name="musical-notes" size={80} color="#fff" />
              </LinearGradient>
              
              {isPlaying && (
                <>
                  <View style={[styles.pulseRing, { borderColor: currentTrack.color + '40' }]} />
                  <View style={[styles.pulseRing2, { borderColor: currentTrack.color + '20' }]} />
                </>
              )}
            </Animated.View>
          </View>

          {/* Track Info */}
          <View style={styles.trackInfoContainer}>
            <Text style={[styles.fullTitle, isDark && styles.textDark]} numberOfLines={2}>
              {currentTrack.title}
            </Text>
            <Text style={styles.fullArtist}>{currentTrack.artist}</Text>
          </View>

          {/* Progress Slider */}
          <View style={styles.progressContainer}>
            <Slider
              value={position}
              minimumValue={0}
              maximumValue={duration || 1}
              onSlidingComplete={(value) => seekTo(value)}
              minimumTrackTintColor={currentTrack.color}
              maximumTrackTintColor={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}
              thumbTintColor={currentTrack.color}
              style={styles.slider}
            />
            <View style={styles.timeContainer}>
              <Text style={[styles.timeText, isDark && styles.textDark]}>{formattedPosition}</Text>
              <Text style={[styles.timeText, isDark && styles.textDark]}>{formattedDuration}</Text>
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controlsContainer}>
            <TouchableOpacity 
              onPress={shuffle} 
              style={[styles.controlButton, isShuffled && styles.activeControl]}
            >
              <Ionicons name="shuffle" size={24} color={isShuffled ? currentTrack.color : isDark ? '#fff' : '#64748b'} />
            </TouchableOpacity>

            <TouchableOpacity onPress={previousTrack} style={styles.controlButton}>
              <Ionicons name="play-skip-back" size={32} color={isDark ? '#fff' : '#1e293b'} />
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={togglePlayback} 
              style={styles.mainPlayButton}
              disabled={isLoading}
            >
              <LinearGradient
                colors={[currentTrack.color, currentTrack.color + '80']}
                style={styles.mainPlayGradient}
              >
                {isLoading ? (
                  <Ionicons name="hourglass" size={32} color="#fff" />
                ) : (
                  <Ionicons 
                    name={isPlaying ? "pause" : "play"} 
                    size={32} 
                    color="#fff" 
                    style={isPlaying ? {} : { marginLeft: 4 }}
                  />
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={nextTrack} style={styles.controlButton}>
              <Ionicons name="play-skip-forward" size={32} color={isDark ? '#fff' : '#1e293b'} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton}>
              <Ionicons name="repeat" size={24} color={isDark ? '#fff' : '#64748b'} />
            </TouchableOpacity>
          </View>

          {/* Swipe hint text */}
          <Text style={[styles.swipeHintText, isDark && styles.textDark]}>
            Swipe down to minimize • Swipe down fast to close
          </Text>

          {/* Up Next */}
          <View style={styles.queueContainer}>
            <Text style={[styles.queueTitle, isDark && styles.textDark]}>Up Next</Text>
            <Animated.ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.queueScroll}
            >
              {queue.slice(currentIndex + 1, currentIndex + 4).map((track) => (
                <TouchableOpacity 
                  key={track.id} 
                  style={styles.queueItem}
                  onPress={() => playTrack(track)}
                >
                  <View style={[styles.queueArt, { backgroundColor: track.color }]}>
                    <Ionicons name="musical-note" size={16} color="#fff" />
                  </View>
                  <Text style={[styles.queueText, isDark && styles.textDark]} numberOfLines={1}>
                    {track.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </Animated.ScrollView>
          </View>
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};

export const GlobalAudioPlayer = () => {
  const { isMinimized, isExpanded, currentTrack } = useAudio();

  if (!currentTrack) return null;

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      {isMinimized && <MiniPlayer />}
      {isExpanded && <FullPlayer />}
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  textDark: {
    color: '#ffffff',
  },
  miniPlayerContainer: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    right: 20,
    zIndex: 999,
  },
  miniPlayerBlur: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  miniPlayerGradient: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  miniProgressContainer: {
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.1)',
    width: '100%',
  },
  miniProgressBar: {
    height: '100%',
    borderRadius: 2,
  },
  miniContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingTop: 10,
  },
  miniArt: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniTextContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  miniTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  miniArtist: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  miniPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  miniPlayGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeHint: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  swipeLine: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 998,
  },
  fullPlayerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.85,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    overflow: 'hidden',
    zIndex: 999,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  fullHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(100,116,139,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowPlayingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  artContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  artWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumArt: {
    width: 280,
    height: 280,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
  },
  pulseRing: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 2,
    opacity: 0.5,
  },
  pulseRing2: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    borderWidth: 1,
    opacity: 0.3,
  },
  trackInfoContainer: {
    alignItems: 'center',
    marginTop: 30,
    paddingHorizontal: 40,
  },
  fullTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    textAlign: 'center',
  },
  fullArtist: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 8,
  },
  progressContainer: {
    marginTop: 30,
    paddingHorizontal: 30,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -10,
  },
  timeText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 20,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeControl: {
    backgroundColor: 'rgba(102,126,234,0.1)',
  },
  mainPlayButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  mainPlayGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeHintText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
  queueContainer: {
    marginTop: 20,
    paddingLeft: 30,
  },
  queueTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 15,
  },
  queueScroll: {
    paddingRight: 30,
    gap: 15,
  },
  queueItem: {
    alignItems: 'center',
    width: 80,
  },
  queueArt: {
    width: 60,
    height: 60,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  queueText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
  },
});