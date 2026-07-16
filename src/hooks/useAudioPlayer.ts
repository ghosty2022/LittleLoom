import { useState, useCallback, useRef, useEffect } from 'react';
import { useAudioPlayer as useExpoAudioPlayer, useAudioPlayerState } from 'expo-audio';
import * as Haptics from 'expo-haptics';

interface AudioState {
  isPlaying: boolean;
  position: number;        // in milliseconds
  duration: number;        // in milliseconds
  isLoading: boolean;
}

export const useAudioPlayer = (uri: string) => {
  const [state, setState] = useState<AudioState>({
    isPlaying: false,
    position: 0,
    duration: 0,
    isLoading: false,
  });

  const player = useExpoAudioPlayer({ uri });
  const status = useAudioPlayerState(player);
  const isMounted = useRef(true);

  useEffect(() => {
    if (!isMounted.current) return;

     const positionMs = (status?.currentTime ?? 0) * 1000;
    const durationMs = (status?.duration ?? 0) * 1000;

    setState({
      isPlaying: status?.playing ?? false,
      position: positionMs,
      duration: durationMs,
      isLoading: status?.buffering ?? false,
    });
  }, [status]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const togglePlayback = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (state.isPlaying) {
        await player.pause();
        setState(prev => ({ ...prev, isPlaying: false }));
      } else {
        await player.play();
        setState(prev => ({ ...prev, isPlaying: true }));
      }
    } catch (error) {
      console.error('Audio playback error:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [state.isPlaying, player]);

  const stop = useCallback(() => {
    await player.pause();
    player.seekTo(0);
    setState(prev => ({ ...prev, isPlaying: false, position: 0 }));
  }, [player]);

  const seekTo = useCallback((positionMillis: number) => {
    player.seekTo(positionMillis / 1000);
  }, [player]);

  const formatTime = useCallback((millis: number = 0) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  return {
    sound: null,              // kept for backward compatibility
    isPlaying: state.isPlaying,
    position: state.position,
    duration: state.duration,
    isLoading: state.isLoading,
    togglePlayback,
    stop,
    seekTo,
    formatTime,
    progress: state.duration > 0 ? (state.position / state.duration) * 100 : 0,
    formattedPosition: formatTime(state.position),
    formattedDuration: formatTime(state.duration),
  };
};
