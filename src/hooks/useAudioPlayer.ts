import { useState, useCallback, useRef, useEffect } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as Haptics from 'expo-haptics';

interface AudioState {
  sound: Audio.Sound | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  isLoading: boolean;
}

export const useAudioPlayer = (uri: string) => {
  const [state, setState] = useState<AudioState>({
    sound: null,
    isPlaying: false,
    position: 0,
    duration: 0,
    isLoading: false,
  });
  
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
      setState(prev => ({
        ...prev,
        isPlaying: status.isPlaying,
        position: status.positionMillis || 0,
        duration: status.durationMillis || 0,
        isLoading: false,
      }));
      
      // Auto-reset when finished
      if (status.didJustFinish) {
        setState(prev => ({ ...prev, isPlaying: false, position: 0 }));
      }
    }
  }, []);

  const togglePlayback = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      if (!soundRef.current) {
        setState(prev => ({ ...prev, isLoading: true }));
        
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        
        if (!isMounted.current) {
          sound.unloadAsync();
          return;
        }
        
        soundRef.current = sound;
        setState(prev => ({ ...prev, sound, isPlaying: true, isLoading: false }));
      } else if (state.isPlaying) {
        await soundRef.current.pauseAsync();
        setState(prev => ({ ...prev, isPlaying: false }));
      } else {
        await soundRef.current.playAsync();
        setState(prev => ({ ...prev, isPlaying: true }));
      }
    } catch (error) {
      console.error('Audio playback error:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [state.isPlaying, uri, onPlaybackStatusUpdate]);

  const stop = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      setState(prev => ({ ...prev, isPlaying: false, position: 0 }));
    }
  }, []);

  const seekTo = useCallback(async (position: number) => {
    if (soundRef.current) {
      await soundRef.current.setPositionAsync(position);
    }
  }, []);

  const formatTime = useCallback((millis: number = 0) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  return {
    ...state,
    togglePlayback,
    stop,
    seekTo,
    formatTime,
    progress: state.duration > 0 ? (state.position / state.duration) * 100 : 0,
    formattedPosition: formatTime(state.position),
    formattedDuration: formatTime(state.duration),
  };
};