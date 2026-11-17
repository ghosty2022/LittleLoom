// hooks/useRingtones.ts
import { useCallback, useEffect, useRef } from 'react';
import { AudioModule, createAudioPlayer } from 'expo-audio';

const RING_IN = require('../../assets/sounds/ring_incoming.mp3');
const RING_OUT = require('../../assets/sounds/ring_outgoing.mp3');

export type RingKind = 'incoming' | 'outgoing';

/**
 * Central ringtone player. Both CallContext and CallScreen use this
 * so we never end up with two overlapping ringtracks.
 */
export function useRingtones() {
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);

  const stop = useCallback(() => {
    try {
      playerRef.current?.pause();
      playerRef.current?.remove();
    } catch {}
    playerRef.current = null;
  }, []);

  const start = useCallback(async (kind: RingKind) => {
    stop();
    try {
      await AudioModule.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      const player = createAudioPlayer(kind === 'incoming' ? RING_IN : RING_OUT);
      player.loop = true;
      player.volume = 1;
      player.play();
      playerRef.current = player;
    } catch (e) {
      if (__DEV__) console.warn('[useRingtones] start failed', e);
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { start, stop };
}