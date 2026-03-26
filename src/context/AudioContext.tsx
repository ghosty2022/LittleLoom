import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as Haptics from 'expo-haptics';

// Sound tracks data
export const SOUND_TRACKS = [
  { id: '1', title: 'White Noise', artist: 'Sleep Aid', duration: '3:45', color: '#a1c4fd', image: 'https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=150&q=80', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: '2', title: 'Lullaby', artist: 'Baby Sleep', duration: '4:20', color: '#fbc2eb', image: 'https://images.unsplash.com/photo-1520454974749-611b7248ffc6?w=150&q=80', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: '3', title: 'Rain Sounds', artist: 'Nature', duration: '5:00', color: '#84fab0', image: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=150&q=80', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { id: '4', title: 'Heartbeat', artist: 'Womb Sounds', duration: '3:30', color: '#ff9a9e', image: 'https://images.unsplash.com/photo-1555252333-9f8e92e65df4?w=150&q=80', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
];

export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  duration: string;
  color: string;
  image: string;
  uri: string;
}

interface AudioContextType {
  isPlaying: boolean;
  isLoading: boolean;
  position: number;
  duration: number;
  currentTrack: AudioTrack | null;
  isExpanded: boolean;
  isMinimized: boolean;
  currentIndex: number;  // FIXED: Added currentIndex
  playTrack: (track: AudioTrack) => void;
  togglePlayback: () => void;
  pause: () => void;
  stop: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  seekTo: (position: number) => void;
  shuffle: () => void;
  expandPlayer: () => void;
  minimizePlayer: () => void;
  closePlayer: () => void;
  formatTime: (millis: number) => string;
  progress: number;
  formattedPosition: string;
  formattedDuration: string;
  queue: AudioTrack[];
  isShuffled: boolean;
}

const AudioContext = createContext<AudioContextType | null>(null);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [queue, setQueue] = useState<AudioTrack[]>(SOUND_TRACKS);
  const [currentIndex, setCurrentIndex] = useState(0);  // This exists but wasn't exported
  const [isShuffled, setIsShuffled] = useState(false);
  
  const soundRef = useRef<Audio.Sound | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!isMounted.current) return;
    
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
      setPosition(status.positionMillis || 0);
      setDuration(status.durationMillis || 0);
      setIsLoading(false);
      
      if (status.didJustFinish) {
        nextTrack();
      }
    }
  }, []);

  const playTrack = useCallback(async (track: AudioTrack) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsLoading(true);
      
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: track.uri },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );
      
      if (!isMounted.current) {
        newSound.unloadAsync();
        return;
      }
      
      soundRef.current = newSound;
      setSound(newSound);
      setCurrentTrack(track);
      setIsPlaying(true);
      setIsMinimized(true);
      setIsExpanded(false);
      setIsLoading(false);
      
      const index = queue.findIndex(t => t.id === track.id);
      if (index !== -1) setCurrentIndex(index);
      
    } catch (error) {
      console.error('Error playing track:', error);
      setIsLoading(false);
    }
  }, [queue, onPlaybackStatusUpdate]);

  const togglePlayback = useCallback(async () => {
    if (!soundRef.current) return;
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      if (isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
    } catch (error) {
      console.error('Toggle playback error:', error);
    }
  }, [isPlaying]);

  const pause = useCallback(async () => {
    if (soundRef.current && isPlaying) {
      await soundRef.current.pauseAsync();
    }
  }, [isPlaying]);

  const stop = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      setIsPlaying(false);
      setPosition(0);
    }
  }, []);

  const nextTrack = useCallback(async () => {
    if (queue.length === 0) return;
    
    const nextIndex = (currentIndex + 1) % queue.length;
    const nextTrack = queue[nextIndex];
    
    setCurrentIndex(nextIndex);
    await playTrack(nextTrack);
  }, [currentIndex, queue, playTrack]);

  const previousTrack = useCallback(async () => {
    if (queue.length === 0) return;
    
    const prevIndex = currentIndex === 0 ? queue.length - 1 : currentIndex - 1;
    const prevTrack = queue[prevIndex];
    
    setCurrentIndex(prevIndex);
    await playTrack(prevTrack);
  }, [currentIndex, queue, playTrack]);

  const seekTo = useCallback(async (positionMillis: number) => {
    if (soundRef.current) {
      await soundRef.current.setPositionAsync(positionMillis);
    }
  }, []);

  const shuffle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (!isShuffled) {
      const shuffled = [...queue].sort(() => Math.random() - 0.5);
      setQueue(shuffled);
      setCurrentIndex(0);
      setIsShuffled(true);
    } else {
      setQueue(SOUND_TRACKS);
      const index = SOUND_TRACKS.findIndex(t => t.id === currentTrack?.id);
      setCurrentIndex(index !== -1 ? index : 0);
      setIsShuffled(false);
    }
  }, [isShuffled, queue, currentTrack]);

  const expandPlayer = useCallback(() => {
    setIsExpanded(true);
    setIsMinimized(false);
  }, []);

  const minimizePlayer = useCallback(() => {
    setIsExpanded(false);
    setIsMinimized(true);
  }, []);

  const closePlayer = useCallback(() => {
    stop();
    setIsExpanded(false);
    setIsMinimized(false);
    setCurrentTrack(null);
  }, [stop]);

  const formatTime = useCallback((millis: number = 0) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const progress = duration > 0 ? (position / duration) * 100 : 0;
  const formattedPosition = formatTime(position);
  const formattedDuration = formatTime(duration);

  // FIXED: Added currentIndex to the value object
  const value = {
    isPlaying,
    isLoading,
    position,
    duration,
    currentTrack,
    isExpanded,
    isMinimized,
    currentIndex,  // FIXED: Now exported
    playTrack,
    togglePlayback,
    pause,
    stop,
    nextTrack,
    previousTrack,
    seekTo,
    shuffle,
    expandPlayer,
    minimizePlayer,
    closePlayer,
    formatTime,
    progress,
    formattedPosition,
    formattedDuration,
    queue,
    isShuffled,
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) throw new Error('useAudio must be used within AudioProvider');
  return context;
};

export default AudioProvider;