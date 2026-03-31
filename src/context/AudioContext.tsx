// src/context/AudioContext.tsx
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBaby } from './BabyContext';
import * as DocumentPicker from 'expo-document-picker';

// Enhanced Sound tracks with more variety
export const SOUND_TRACKS = [
  { id: '1', title: 'White Noise', artist: 'Sleep Aid', duration: '3:45', color: '#a1c4fd', image: 'https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=400&q=80', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: '2', title: 'Gentle Lullaby', artist: 'Baby Sleep', duration: '4:20', color: '#fbc2eb', image: 'https://images.unsplash.com/photo-1520454974749-611b7248ffc6?w=400&q=80', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: '3', title: 'Rain on Roof', artist: 'Nature Sounds', duration: '5:00', color: '#84fab0', image: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=400&q=80', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { id: '4', title: 'Mother\'s Heartbeat', artist: 'Womb Sounds', duration: '3:30', color: '#ff9a9e', image: 'https://images.unsplash.com/photo-1555252333-9f8e92e65df4?w=400&q=80', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { id: '5', title: 'Soft Ocean Waves', artist: 'Deep Sleep', duration: '6:15', color: '#4ecdc4', image: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=400&q=80', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
  { id: '6', title: 'Dreamy Piano', artist: 'Night Time', duration: '4:00', color: '#ffe66d', image: 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=400&q=80', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' },
  { id: '7', title: 'Brown Noise', artist: 'Sleep Therapy', duration: '5:30', color: '#d4a5a5', image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&q=80', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3' },
  { id: '8', title: 'Twinkle Stars', artist: 'Classic Lullaby', duration: '2:45', color: '#ffd93d', image: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=400&q=80', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
];

export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  duration: string;
  color: string;
  image: string;
  uri: string;
  source?: 'local' | 'spotify' | 'apple' | 'system';
}

export type PlayerMode = 'ball' | 'mini' | 'full' | 'hidden';

export interface SleepTimer {
  enabled: boolean;
  duration: number;
  endTime?: number;
}

interface AudioContextType {
  isPlaying: boolean;
  isLoading: boolean;
  position: number;
  duration: number;
  currentTrack: AudioTrack | null;
  playerMode: PlayerMode;
  currentIndex: number;
  queue: AudioTrack[];
  isShuffled: boolean;
  favorites: string[]; // Track IDs
  importedTracks: AudioTrack[];
  sleepTimer: SleepTimer;
  
  // Playback controls
  playTrack: (track: AudioTrack) => void;
  togglePlayback: () => void;
  pause: () => void;
  stop: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  seekTo: (position: number) => void;
  shuffle: () => void;
  
  // Player modes
  setPlayerMode: (mode: PlayerMode) => void;
  expandPlayer: () => void;
  minimizePlayer: () => void;
  collapseToBall: () => void;
  closePlayer: () => void;
  
  // Favorites
  toggleFavorite: (trackId: string) => void;
  isFavorite: (trackId: string) => boolean;
  
  // Import
  addImportedTrack: (track: Omit<AudioTrack, 'id'>) => void;
  removeImportedTrack: (id: string) => void;
  importFromDevice: () => Promise<void>;
  
  // Sleep Timer
  setSleepTimer: (minutes: number) => void;
  
  // Utilities
  formatTime: (millis: number) => string;
  progress: number;
  formattedPosition: string;
  formattedDuration: string;
}

const AudioContext = createContext<AudioContextType | null>(null);

const FAVORITES_STORAGE_KEY = '@littleloom_favorites_';
const IMPORTED_STORAGE_KEY = '@littleloom_imported_tracks';
const SLEEP_TIMER_KEY = '@littleloom_sleep_timer';

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentBaby } = useBaby();
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [playerMode, setPlayerMode] = useState<PlayerMode>('hidden');
  const [queue, setQueue] = useState<AudioTrack[]>(SOUND_TRACKS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isShuffled, setIsShuffled] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [importedTracks, setImportedTracks] = useState<AudioTrack[]>([]);
  const [sleepTimer, setSleepTimerState] = useState<SleepTimer>({ enabled: false, duration: 0 });
  
  const soundRef = useRef<Audio.Sound | null>(null);
  const isMounted = useRef(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load favorites for current baby
  useEffect(() => {
    if (currentBaby?.id) {
      loadFavorites();
    }
  }, [currentBaby?.id]);

  // Load imported tracks
  useEffect(() => {
    loadImportedTracks();
  }, []);

  // Load sleep timer
  useEffect(() => {
    loadSleepTimer();
  }, []);

  // Handle sleep timer countdown
  useEffect(() => {
    if (sleepTimer.enabled && sleepTimer.endTime) {
      const checkTimer = () => {
        const now = Date.now();
        if (now >= sleepTimer.endTime!) {
          stop();
          setSleepTimerState({ enabled: false, duration: 0 });
          AsyncStorage.removeItem(SLEEP_TIMER_KEY);
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }
      };

      timerRef.current = setInterval(checkTimer, 1000);
      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [sleepTimer]);

  const loadFavorites = async () => {
    if (!currentBaby?.id) return;
    try {
      const stored = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY + currentBaby.id);
      if (stored) setFavorites(JSON.parse(stored));
    } catch (e) {
      console.error('Error loading favorites:', e);
    }
  };

  const loadImportedTracks = async () => {
    try {
      const stored = await AsyncStorage.getItem(IMPORTED_STORAGE_KEY);
      if (stored) setImportedTracks(JSON.parse(stored));
    } catch (e) {
      console.error('Error loading imported tracks:', e);
    }
  };

  const loadSleepTimer = async () => {
    try {
      const stored = await AsyncStorage.getItem(SLEEP_TIMER_KEY);
      if (stored) {
        const timer = JSON.parse(stored);
        if (timer.enabled && timer.endTime > Date.now()) {
          setSleepTimerState(timer);
        } else {
          await AsyncStorage.removeItem(SLEEP_TIMER_KEY);
        }
      }
    } catch (e) {
      console.error('Error loading sleep timer:', e);
    }
  };

  const saveFavorites = async (newFavorites: string[]) => {
    if (!currentBaby?.id) return;
    try {
      await AsyncStorage.setItem(FAVORITES_STORAGE_KEY + currentBaby.id, JSON.stringify(newFavorites));
    } catch (e) {
      console.error('Error saving favorites:', e);
    }
  };

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
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
      setPlayerMode('mini');
      setIsLoading(false);
      
      const allTracks = [...SOUND_TRACKS, ...importedTracks];
      const index = allTracks.findIndex(t => t.id === track.id);
      if (index !== -1) setCurrentIndex(index);
      
    } catch (error) {
      console.error('Error playing track:', error);
      setIsLoading(false);
    }
  }, [importedTracks, onPlaybackStatusUpdate]);

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
    const allTracks = [...SOUND_TRACKS, ...importedTracks];
    if (allTracks.length === 0) return;
    
    const nextIndex = (currentIndex + 1) % allTracks.length;
    const nextTrack = allTracks[nextIndex];
    
    setCurrentIndex(nextIndex);
    await playTrack(nextTrack);
  }, [currentIndex, importedTracks, playTrack]);

  const previousTrack = useCallback(async () => {
    const allTracks = [...SOUND_TRACKS, ...importedTracks];
    if (allTracks.length === 0) return;
    
    const prevIndex = currentIndex === 0 ? allTracks.length - 1 : currentIndex - 1;
    const prevTrack = allTracks[prevIndex];
    
    setCurrentIndex(prevIndex);
    await playTrack(prevTrack);
  }, [currentIndex, importedTracks, playTrack]);

  const seekTo = useCallback(async (positionMillis: number) => {
    if (soundRef.current) {
      await soundRef.current.setPositionAsync(positionMillis);
    }
  }, []);

  const shuffle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const allTracks = [...SOUND_TRACKS, ...importedTracks];
    if (!isShuffled) {
      const shuffled = [...allTracks].sort(() => Math.random() - 0.5);
      setQueue(shuffled);
      setCurrentIndex(0);
      setIsShuffled(true);
    } else {
      setQueue(allTracks);
      const index = allTracks.findIndex(t => t.id === currentTrack?.id);
      setCurrentIndex(index !== -1 ? index : 0);
      setIsShuffled(false);
    }
  }, [isShuffled, currentTrack, importedTracks]);

  // Player mode transitions
  const expandPlayer = useCallback(() => {
    setPlayerMode('full');
  }, []);

  const minimizePlayer = useCallback(() => {
    setPlayerMode('mini');
  }, []);

  const collapseToBall = useCallback(() => {
    setPlayerMode('ball');
  }, []);

  const closePlayer = useCallback(() => {
    stop();
    setPlayerMode('hidden');
    setCurrentTrack(null);
  }, [stop]);

  // Favorites
  const toggleFavorite = useCallback(async (trackId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newFavorites = favorites.includes(trackId)
      ? favorites.filter(id => id !== trackId)
      : [...favorites, trackId];
    setFavorites(newFavorites);
    await saveFavorites(newFavorites);
  }, [favorites]);

  const isFavorite = useCallback((trackId: string) => {
    return favorites.includes(trackId);
  }, [favorites]);

  // Import tracks
  const addImportedTrack = useCallback(async (track: Omit<AudioTrack, 'id'>) => {
    const newTrack: AudioTrack = {
      ...track,
      id: `imported_${Date.now()}`,
    };
    const updated = [...importedTracks, newTrack];
    setImportedTracks(updated);
    await AsyncStorage.setItem(IMPORTED_STORAGE_KEY, JSON.stringify(updated));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [importedTracks]);

  const removeImportedTrack = useCallback(async (id: string) => {
    const updated = importedTracks.filter(t => t.id !== id);
    setImportedTracks(updated);
    await AsyncStorage.setItem(IMPORTED_STORAGE_KEY, JSON.stringify(updated));
  }, [importedTracks]);

  const importFromDevice = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
      
      const newTrack: AudioTrack = {
        id: `imported_${Date.now()}`,
        title: fileName,
        artist: 'Imported',
        duration: '0:00',
        color: '#9b59b6',
        image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80',
        uri: file.uri,
        source: 'local',
      };

      await addImportedTrack(newTrack);
    } catch (error) {
      console.error('Error importing from device:', error);
      throw error;
    }
  }, [addImportedTrack]);

  const setSleepTimer = useCallback(async (minutes: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (minutes === 0) {
      setSleepTimerState({ enabled: false, duration: 0 });
      await AsyncStorage.removeItem(SLEEP_TIMER_KEY);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } else {
      const endTime = Date.now() + (minutes * 60 * 1000);
      const timerData = { enabled: true, duration: minutes, endTime };
      setSleepTimerState(timerData);
      await AsyncStorage.setItem(SLEEP_TIMER_KEY, JSON.stringify(timerData));
    }
  }, []);

  const formatTime = useCallback((millis: number = 0) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const progress = duration > 0 ? (position / duration) * 100 : 0;
  const formattedPosition = formatTime(position);
  const formattedDuration = formatTime(duration);

  const value = {
    isPlaying,
    isLoading,
    position,
    duration,
    currentTrack,
    playerMode,
    currentIndex,
    queue,
    isShuffled,
    favorites,
    importedTracks,
    sleepTimer,
    playTrack,
    togglePlayback,
    pause,
    stop,
    nextTrack,
    previousTrack,
    seekTo,
    shuffle,
    setPlayerMode,
    expandPlayer,
    minimizePlayer,
    collapseToBall,
    closePlayer,
    toggleFavorite,
    isFavorite,
    addImportedTrack,
    removeImportedTrack,
    importFromDevice,
    setSleepTimer,
    formatTime,
    progress,
    formattedPosition,
    formattedDuration,
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