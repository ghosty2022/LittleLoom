import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAppSetting, setAppSetting, deleteAppSetting } from '@/database/dbHelpers';
import { useBaby } from './BabyContext';
import * as DocumentPicker from 'expo-document-picker';

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
  favorites: string[];
  importedTracks: AudioTrack[];
  sleepTimer: SleepTimer;
  
  playTrack: (track: AudioTrack) => void;
  togglePlayback: () => void;
  pause: () => void;
  stop: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  seekTo: (position: number) => void;
  shuffle: () => void;
  
  setPlayerMode: (mode: PlayerMode) => void;
  expandPlayer: () => void;
  minimizePlayer: () => void;
  collapseToBall: () => void;
  closePlayer: () => void;
  
  toggleFavorite: (trackId: string) => void;
  isFavorite: (trackId: string) => boolean;
  
  addImportedTrack: (track: Omit<AudioTrack, 'id'>) => void;
  removeImportedTrack: (id: string) => void;
  importFromDevice: () => Promise<void>;
  
  setSleepTimer: (minutes: number) => void;
  
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
  
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [playerMode, setPlayerMode] = useState<PlayerMode>('hidden');
  const [queue, setQueue] = useState<AudioTrack[]>(SOUND_TRACKS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isShuffled, setIsShuffled] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [importedTracks, setImportedTracks] = useState<AudioTrack[]>([]);
  const [sleepTimer, setSleepTimerState] = useState<SleepTimer>({ enabled: false, duration: 0 });
  
  const player = useAudioPlayer(currentTrack?.uri ?? '');
  const status = useAudioPlayerStatus(player);
  
  const isPlaying = status?.playing ?? false;
  const duration = (status?.duration ?? 0) * 1000;   // seconds → ms
  const position = (status?.currentTime ?? 0) * 1000; // seconds → ms
  const isLoading = status?.isBuffering ?? false;
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { if (currentBaby?.id) loadFavorites(); }, [currentBaby?.id]);
  useEffect(() => { loadImportedTracks(); }, []);
  useEffect(() => { loadSleepTimer(); }, []);

  useEffect(() => {
    if (!sleepTimer.enabled || !sleepTimer.endTime) return;
    
    const checkTimer = () => {
      if (Date.now() >= sleepTimer.endTime!) {
        stop();
        setSleepTimerState({ enabled: false, duration: 0 });
        AsyncStorage.removeItem(SLEEP_TIMER_KEY);
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      }
    };

    timerRef.current = setInterval(checkTimer, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sleepTimer]);

  const loadFavorites = async () => {
    if (!currentBaby?.id) return;
    try {
      const stored = await getAppSetting(FAVORITES_STORAGE_KEY + currentBaby.id);
      if (stored) setFavorites(JSON.parse(stored));
    } catch (e) { console.error('Error loading favorites:', e); }
  };

  const loadImportedTracks = async () => {
    try {
      const stored = await getAppSetting(IMPORTED_STORAGE_KEY);
      if (stored) setImportedTracks(JSON.parse(stored));
    } catch (e) { console.error('Error loading imported tracks:', e); }
  };

  const loadSleepTimer = async () => {
    try {
      const stored = await getAppSetting(SLEEP_TIMER_KEY);
      if (stored) {
        const timer = JSON.parse(stored);
        if (timer.enabled && timer.endTime > Date.now()) {
          setSleepTimerState(timer);
        } else {
          await deleteAppSetting(SLEEP_TIMER_KEY);
        }
      }
    } catch (e) { console.error('Error loading sleep timer:', e); }
  };

  const saveFavorites = async (newFavorites: string[]) => {
    if (!currentBaby?.id) return;
    try {
      await setAppSetting(FAVORITES_STORAGE_KEY + currentBaby.id, JSON.stringify(newFavorites));
    } catch (e) { console.error('Error saving favorites:', e); }
  };

  const playTrack = useCallback((track: AudioTrack) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentTrack(track);
      player.replace(track.uri);
      player.play();
      setPlayerMode('mini');
      
      const allTracks = [...SOUND_TRACKS, ...importedTracks];
      const index = allTracks.findIndex(t => t.id === track.id);
      if (index !== -1) setCurrentIndex(index);
    } catch (error) {
      console.error('Error playing track:', error);
    }
  }, [importedTracks, player]);

  const togglePlayback = useCallback(() => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (isPlaying) {
        player.pause();
      } else {
        player.play();
      }
    } catch (error) {
      console.error('Toggle playback error:', error);
    }
  }, [isPlaying, player]);

  const pause = useCallback(() => {
    if (isPlaying) player.pause();
  }, [isPlaying, player]);

  const stop = useCallback(() => {
    player.pause();
    player.seekTo(0);
  }, [player]);

  const nextTrack = useCallback(() => {
    const allTracks = [...SOUND_TRACKS, ...importedTracks];
    if (allTracks.length === 0) return;
    
    const nextIndex = (currentIndex + 1) % allTracks.length;
    setCurrentIndex(nextIndex);
    playTrack(allTracks[nextIndex]);
  }, [currentIndex, importedTracks, playTrack]);

  const previousTrack = useCallback(() => {
    const allTracks = [...SOUND_TRACKS, ...importedTracks];
    if (allTracks.length === 0) return;
    
    const prevIndex = currentIndex === 0 ? allTracks.length - 1 : currentIndex - 1;
    setCurrentIndex(prevIndex);
    playTrack(allTracks[prevIndex]);
  }, [currentIndex, importedTracks, playTrack]);

  const seekTo = useCallback((positionMillis: number) => {
    player.seekTo(positionMillis / 1000); // ms → seconds
  }, [player]);

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

  const expandPlayer = useCallback(() => setPlayerMode('full'), []);
  const minimizePlayer = useCallback(() => setPlayerMode('mini'), []);
  const collapseToBall = useCallback(() => setPlayerMode('ball'), []);
  
  const closePlayer = useCallback(() => {
    stop();
    setPlayerMode('hidden');
    setCurrentTrack(null);
  }, [stop]);

  const toggleFavorite = useCallback(async (trackId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newFavorites = favorites.includes(trackId)
      ? favorites.filter(id => id !== trackId)
      : [...favorites, trackId];
    setFavorites(newFavorites);
    await saveFavorites(newFavorites);
  }, [favorites]);

  const isFavorite = useCallback((trackId: string) => favorites.includes(trackId), [favorites]);

  const addImportedTrack = useCallback(async (track: Omit<AudioTrack, 'id'>) => {
    const newTrack: AudioTrack = { ...track, id: `imported_${Date.now()}` };
    const updated = [...importedTracks, newTrack];
    setImportedTracks(updated);
    await setAppSetting(IMPORTED_STORAGE_KEY, JSON.stringify(updated));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [importedTracks]);

  const removeImportedTrack = useCallback(async (id: string) => {
    const updated = importedTracks.filter(t => t.id !== id);
    setImportedTracks(updated);
    await setAppSetting(IMPORTED_STORAGE_KEY, JSON.stringify(updated));
  }, [importedTracks]);

  const importFromDevice = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      const fileName = file.name.replace(/\.[^/.]+$/, "");
      
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
      await deleteAppSetting(SLEEP_TIMER_KEY);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    } else {
      const endTime = Date.now() + (minutes * 60 * 1000);
      const timerData = { enabled: true, duration: minutes, endTime };
      setSleepTimerState(timerData);
      await setAppSetting(SLEEP_TIMER_KEY, JSON.stringify(timerData));
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

  useEffect(() => {
    if (status?.didJustFinish) {
      nextTrack();
    }
  }, [status?.didJustFinish, nextTrack]);

  const value: AudioContextType = {
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
