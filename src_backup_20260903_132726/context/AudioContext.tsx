// src/context/AudioContext.tsx
// Full Supabase implementation with storage support

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/utils/supabase';
import { decode } from 'base64-arraybuffer';

// SAFE: Get useBaby only if available
let useBabySafe: any = null;
try {
  const babyModule = require('./BabyContext');
  useBabySafe = babyModule.useBaby;
} catch {
  useBabySafe = () => ({ currentBaby: null });
}

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
  source?: 'local' | 'spotify' | 'apple' | 'system' | 'supabase';
  storagePath?: string;
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
const AUDIO_BUCKET = 'audio';

// ─── SAFE Baby access ─────────────────────────────────────────────────────
// Use a try-catch wrapper to handle case where BabyContext isn't ready
const useBabySafeWrapper = () => {
  try {
    const { useBaby } = require('./BabyContext');
    return useBaby();
  } catch (e) {
    console.warn('[AudioProvider] BabyContext not available');
    return { currentBaby: null, getCurrentBabyId: () => null };
  }
};

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ─── SAFE: Get baby data only if available ──────────────────────────
  let babyData: any = null;
  try {
    const { useBaby } = require('./BabyContext');
    babyData = useBaby();
  } catch {
    babyData = { currentBaby: null, getCurrentBabyId: () => null };
  }
  const { currentBaby } = babyData || { currentBaby: null };

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
  const duration = (status?.duration ?? 0) * 1000;
  const position = (status?.currentTime ?? 0) * 1000;
  const isLoading = status?.isBuffering ?? false;

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Load favorites using safe baby ID ───────────────────────────────
  const getBabyId = useCallback(() => {
    return currentBaby?.id || null;
  }, [currentBaby]);

  useEffect(() => {
    const id = getBabyId();
    if (id) loadFavorites(id);
  }, [getBabyId]);

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

  /* ─── Load Favorites ─────────────────────────────────────────────────── */
  const loadFavorites = async (babyId: string) => {
    if (!babyId) return;
    try {
      const stored = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY + babyId);
      if (stored) setFavorites(JSON.parse(stored));
    } catch (e) { console.error('Error loading favorites:', e); }
  };

  /* ─── Load Imported Tracks ──────────────────────────────────────────── */
  const loadImportedTracks = async () => {
    try {
      const stored = await AsyncStorage.getItem(IMPORTED_STORAGE_KEY);
      if (stored) {
        const tracks = JSON.parse(stored);
        const validTracks = [];
        for (const track of tracks) {
          if (track.storagePath) {
            const { data } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(track.storagePath);
            if (data?.publicUrl) {
              track.uri = data.publicUrl;
              validTracks.push(track);
            }
          } else {
            validTracks.push(track);
          }
        }
        setImportedTracks(validTracks);
      }
    } catch (e) { console.error('Error loading imported tracks:', e); }
  };

  /* ─── Load Sleep Timer ───────────────────────────────────────────────── */
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
    } catch (e) { console.error('Error loading sleep timer:', e); }
  };

  /* ─── Save Favorites ────────────────────────────────────────────────── */
  const saveFavorites = async (newFavorites: string[]) => {
    const babyId = getBabyId();
    if (!babyId) return;
    try {
      await AsyncStorage.setItem(FAVORITES_STORAGE_KEY + babyId, JSON.stringify(newFavorites));
    } catch (e) { console.error('Error saving favorites:', e); }
  };

  /* ─── Play Track ─────────────────────────────────────────────────────── */
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

  /* ─── Toggle Playback ────────────────────────────────────────────────── */
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

  /* ─── Pause ─────────────────────────────────────────────────────────── */
  const pause = useCallback(() => {
    if (isPlaying) player.pause();
  }, [isPlaying, player]);

  /* ─── Stop ──────────────────────────────────────────────────────────── */
  const stop = useCallback(() => {
    player.pause();
    player.seekTo(0);
  }, [player]);

  /* ─── Next Track ────────────────────────────────────────────────────── */
  const nextTrack = useCallback(() => {
    const allTracks = [...SOUND_TRACKS, ...importedTracks];
    if (allTracks.length === 0) return;

    const nextIndex = (currentIndex + 1) % allTracks.length;
    setCurrentIndex(nextIndex);
    playTrack(allTracks[nextIndex]);
  }, [currentIndex, importedTracks, playTrack]);

  /* ─── Previous Track ────────────────────────────────────────────────── */
  const previousTrack = useCallback(() => {
    const allTracks = [...SOUND_TRACKS, ...importedTracks];
    if (allTracks.length === 0) return;

    const prevIndex = currentIndex === 0 ? allTracks.length - 1 : currentIndex - 1;
    setCurrentIndex(prevIndex);
    playTrack(allTracks[prevIndex]);
  }, [currentIndex, importedTracks, playTrack]);

  /* ─── Seek To ───────────────────────────────────────────────────────── */
  const seekTo = useCallback((positionMillis: number) => {
    player.seekTo(positionMillis / 1000);
  }, [player]);

  /* ─── Shuffle ───────────────────────────────────────────────────────── */
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

  /* ─── Player Mode ───────────────────────────────────────────────────── */
  const expandPlayer = useCallback(() => setPlayerMode('full'), []);
  const minimizePlayer = useCallback(() => setPlayerMode('mini'), []);
  const collapseToBall = useCallback(() => setPlayerMode('ball'), []);
  const closePlayer = useCallback(() => {
    stop();
    setPlayerMode('hidden');
    setCurrentTrack(null);
  }, [stop]);

  /* ─── Toggle Favorite ───────────────────────────────────────────────── */
  const toggleFavorite = useCallback(async (trackId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newFavorites = favorites.includes(trackId)
      ? favorites.filter(id => id !== trackId)
      : [...favorites, trackId];
    setFavorites(newFavorites);
    await saveFavorites(newFavorites);
  }, [favorites]);

  /* ─── Is Favorite ───────────────────────────────────────────────────── */
  const isFavorite = useCallback((trackId: string) => favorites.includes(trackId), [favorites]);

  /* ─── Add Imported Track ────────────────────────────────────────────── */
  const addImportedTrack = useCallback(async (track: Omit<AudioTrack, 'id'>) => {
    const newTrack: AudioTrack = { ...track, id: `imported_${Date.now()}` };

    if (track.uri && track.uri.startsWith('file://')) {
      try {
        const fileData = await FileSystem.readAsStringAsync(track.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const fileExt = track.uri.split('.').pop() || 'mp3';
        const storagePath = `tracks/${newTrack.id}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from(AUDIO_BUCKET)
          .upload(storagePath, decode(fileData), {
            contentType: `audio/${fileExt}`,
            cacheControl: '3600',
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(storagePath);
          newTrack.uri = urlData.publicUrl;
          newTrack.storagePath = storagePath;
          newTrack.source = 'supabase';
        }
      } catch (error) {
        console.error('Error uploading audio:', error);
      }
    }

    const updated = [...importedTracks, newTrack];
    setImportedTracks(updated);
    await AsyncStorage.setItem(IMPORTED_STORAGE_KEY, JSON.stringify(updated));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [importedTracks]);

  /* ─── Remove Imported Track ─────────────────────────────────────────── */
  const removeImportedTrack = useCallback(async (id: string) => {
    const track = importedTracks.find(t => t.id === id);
    if (track?.storagePath) {
      await supabase.storage.from(AUDIO_BUCKET).remove([track.storagePath]);
    }
    const updated = importedTracks.filter(t => t.id !== id);
    setImportedTracks(updated);
    await AsyncStorage.setItem(IMPORTED_STORAGE_KEY, JSON.stringify(updated));
  }, [importedTracks]);

  /* ─── Import From Device ────────────────────────────────────────────── */
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

  /* ─── Set Sleep Timer ───────────────────────────────────────────────── */
  const setSleepTimer = useCallback(async (minutes: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (minutes === 0) {
      setSleepTimerState({ enabled: false, duration: 0 });
      await AsyncStorage.removeItem(SLEEP_TIMER_KEY);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    } else {
      const endTime = Date.now() + (minutes * 60 * 1000);
      const timerData = { enabled: true, duration: minutes, endTime };
      setSleepTimerState(timerData);
      await AsyncStorage.setItem(SLEEP_TIMER_KEY, JSON.stringify(timerData));
    }
  }, []);

  /* ─── Format Time ───────────────────────────────────────────────────── */
  const formatTime = useCallback((millis: number = 0) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  /* ─── Computed Values ───────────────────────────────────────────────── */
  const progress = duration > 0 ? (position / duration) * 100 : 0;
  const formattedPosition = formatTime(position);
  const formattedDuration = formatTime(duration);

  /* ─── Auto-next when track finishes ────────────────────────────────── */
  useEffect(() => {
    if (status?.didJustFinish) {
      nextTrack();
    }
  }, [status?.didJustFinish, nextTrack]);

  /* ─── Context Value ─────────────────────────────────────────────────── */
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