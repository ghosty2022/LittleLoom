// src/context/CallContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useAuth } from './AuthContext';
import { supabase } from '@/utils/supabase';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */
export type CallType = 'voice' | 'video';
export type CallStatus =
  | 'idle'
  | 'ringing-out'
  | 'ringing-in'
  | 'connecting'
  | 'active'
  | 'ended';

export interface CallParticipant {
  id: string;
  name: string;
  avatar?: string;
  role?: string;
}

export interface ActiveCall {
  callId: string;
  chatId: string;
  type: CallType;
  status: CallStatus;
  peer: CallParticipant;
  connectedAt?: number;
  ringingAt: number;
  isOutgoing: boolean;
  isMuted: boolean;
  isSpeaker: boolean;
  isCameraOn: boolean;
  peerOnline?: boolean;
}

export interface CallContextType {
  activeCall: ActiveCall | null;
  waitingCall: ActiveCall | null;
  startCall: (params: {
    chatId: string;
    type: CallType;
    peer: CallParticipant;
  }) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleCamera: () => void;
  callDurationSec: number;
}

const CallContext = createContext<CallContextType | null>(null);

/* ═══════════════════════════════════════════════════════════════
   COLOURS
   ═══════════════════════════════════════════════════════════════ */
const DS = {
  primary: '#6366f1',
  accent: '#ec4899',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  white: '#ffffff',
  gray400: '#a8a29e',
  darkBg: '#0c0a09',
  darkCard: '#1c1917',
};

const RING_TIMEOUT_MS = 45_000;
const ACTIVE_MAX_MS = 60 * 60_000;

const isImageUri = (v: string | undefined | null): boolean => {
  if (!v || typeof v !== 'string') return false;
  return (
    v.startsWith('http') ||
    v.startsWith('file://') ||
    v.startsWith('data:')
  );
};

/* ═══════════════════════════════════════════════════════════════
   PROVIDER
   ═══════════════════════════════════════════════════════════════ */
export const CallProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { userProfile } = useAuth();
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [waitingCall, setWaitingCall] = useState<ActiveCall | null>(null);
  const [callDurationSec, setCallDurationSec] = useState(0);

  const callChannelRef = useRef<any>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeMaxRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringPlayerRef = useRef<AudioPlayer | null>(null);
  const ringHapticIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const activeCallRef = useRef<ActiveCall | null>(null);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  /* ── Ringtone management (expo-audio) ──────────────────── */
  const stopRingtone = useCallback(() => {
    try {
      if (ringHapticIntervalRef.current) {
        clearInterval(ringHapticIntervalRef.current);
        ringHapticIntervalRef.current = null;
      }
      if (ringPlayerRef.current) {
        ringPlayerRef.current.pause();
        ringPlayerRef.current.remove();
        ringPlayerRef.current = null;
      }
    } catch {}
  }, []);

  const playRingtone = useCallback(
    (kind: 'incoming' | 'outgoing') => {
      stopRingtone();
      // 1. Try to load the bundled ringtone (drop the MP3 files in
      //    assets/sounds/ring_incoming.mp3 and ring_outgoing.mp3).
      try {
        const source =
          kind === 'incoming'
            ? // @ts-ignore – metro asset resolution
              require('../../assets/sounds/ring_incoming.mp3')
            : // @ts-ignore
              require('../../assets/sounds/ring_outgoing.mp3');
        const player = createAudioPlayer(source);
        player.loop = true;
        player.volume = 0.8;
        player.play();
        ringPlayerRef.current = player;
      } catch {
        // 2. Fallback: haptic pattern that mimics a ringtone.
        let n = 0;
        ringHapticIntervalRef.current = setInterval(() => {
          n++;
          if (kind === 'incoming') {
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning,
            ).catch(() => {});
          } else if (n % 2 === 0) {
            Haptics.impactAsync(
              Haptics.ImpactFeedbackStyle.Medium,
            ).catch(() => {});
          }
        }, 1500);
      }
    },
    [stopRingtone],
  );

  /* ── Auto-cancel unanswered outgoing calls ─────────────── */
  const scheduleRingTimeout = useCallback(
    (callId: string) => {
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = setTimeout(() => {
        const cur = activeCallRef.current;
        if (cur?.callId === callId && cur.status === 'ringing-out') {
          callChannelRef.current
            ?.send({
              type: 'broadcast',
              event: 'call-end',
              payload: { callId, to: cur.peer.id, reason: 'timeout' },
            })
            .catch(() => {});
          setActiveCall((prev) =>
            prev && prev.callId === callId
              ? { ...prev, status: 'ended' }
              : prev,
          );
          stopRingtone();
          setTimeout(() => setActiveCall(null), 1200);
        }
      }, RING_TIMEOUT_MS);
    },
    [stopRingtone],
  );

  /* ── Auto-end active calls after hard cap ──────────────── */
  const scheduleActiveMax = useCallback((callId: string) => {
    if (activeMaxRef.current) clearTimeout(activeMaxRef.current);
    activeMaxRef.current = setTimeout(() => {
      const cur = activeCallRef.current;
      if (cur?.callId === callId && cur.status === 'active') {
        callChannelRef.current
          ?.send({
            type: 'broadcast',
            event: 'call-end',
            payload: { callId, to: cur.peer.id, reason: 'timeout' },
          })
          .catch(() => {});
        setActiveCall((prev) =>
          prev && prev.callId === callId
            ? { ...prev, status: 'ended' }
            : prev,
        );
        setTimeout(() => setActiveCall(null), 1200);
      }
    }, ACTIVE_MAX_MS);
  }, []);

  /* ── Duration ticker ───────────────────────────────────── */
  useEffect(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (activeCall?.status === 'active' && activeCall?.connectedAt) {
      setCallDurationSec(
        Math.max(0, Math.floor((Date.now() - activeCall.connectedAt) / 1000)),
      );
      durationIntervalRef.current = setInterval(() => {
        setCallDurationSec(
          Math.max(
            0,
            Math.floor((Date.now() - activeCall.connectedAt!) / 1000),
          ),
        );
      }, 1000);
    } else {
      setCallDurationSec(0);
    }
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    };
  }, [activeCall?.status, activeCall?.connectedAt]);

  /* ── Ringtone follows status ───────────────────────────── */
  useEffect(() => {
    if (!activeCall) {
      stopRingtone();
      return;
    }
    if (activeCall.status === 'ringing-in') {
      playRingtone('incoming');
    } else if (activeCall.status === 'ringing-out') {
      playRingtone('outgoing');
      scheduleRingTimeout(activeCall.callId);
    } else if (
      activeCall.status === 'connecting' ||
      activeCall.status === 'active'
    ) {
      stopRingtone();
      if (activeCall.status === 'active') {
        scheduleActiveMax(activeCall.callId);
      }
    } else if (activeCall.status === 'ended') {
      stopRingtone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCall?.status, activeCall?.callId]);

  /* ── Cleanup ───────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      if (activeMaxRef.current) clearTimeout(activeMaxRef.current);
      stopRingtone();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Signalling channel ────────────────────────────────── */
  useEffect(() => {
    const meId = userProfile?.id;
    if (!meId) return;

    const channel = supabase.channel(`calls-user-${meId}`, {
      config: { broadcast: { self: false } },
    });

    channel.on('broadcast', { event: 'call-offer' }, (payload: any) => {
      const data = payload?.payload;
      if (!data?.callId || !data?.from) return;

      setActiveCall((prev) => {
        if (prev) {
          if (prev.callId !== data.callId) {
            // ── CALL WAITING ─────────────────────────────
            setWaitingCall({
              callId: data.callId,
              chatId: data.chatId,
              type: data.type,
              status: 'ringing-in',
              peer: data.from,
              ringingAt: Date.now(),
              isOutgoing: false,
              isMuted: false,
              isSpeaker: false,
              isCameraOn: false,
              peerOnline: true,
            });
            callChannelRef.current
              ?.send({
                type: 'broadcast',
                event: 'call-busy',
                payload: { callId: data.callId, to: data.from.id },
              })
              .catch(() => {});
            return prev;
          }
          return prev;
        }
        return {
          callId: data.callId,
          chatId: data.chatId,
          type: data.type,
          status: 'ringing-in',
          peer: data.from,
          ringingAt: Date.now(),
          isOutgoing: false,
          isMuted: false,
          isSpeaker: false,
          isCameraOn: false,
          peerOnline: true,
        };
      });
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Warning,
      ).catch(() => {});
    });

    channel.on('broadcast', { event: 'call-answer' }, (payload: any) => {
      const data = payload?.payload;
      if (!data?.callId) return;
      setActiveCall((prev) => {
        if (!prev || prev.callId !== data.callId) return prev;
        if (prev.status !== 'ringing-out' && prev.status !== 'connecting') {
          return prev;
        }
        return {
          ...prev,
          status: 'active',
          connectedAt: Date.now(),
          peerOnline: true,
        };
      });
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    });

    channel.on('broadcast', { event: 'call-decline' }, (payload: any) => {
      const data = payload?.payload;
      if (!data?.callId) return;
      setActiveCall((prev) => {
        if (!prev || prev.callId !== data.callId) return prev;
        return { ...prev, status: 'ended' };
      });
      setTimeout(() => setActiveCall(null), 1200);
    });

    channel.on('broadcast', { event: 'call-busy' }, (payload: any) => {
      const data = payload?.payload;
      if (!data?.callId) return;
      setActiveCall((prev) => {
        if (!prev || prev.callId !== data.callId) return prev;
        return { ...prev, status: 'ended' };
      });
      setTimeout(() => setActiveCall(null), 1200);
    });

    channel.on('broadcast', { event: 'call-end' }, (payload: any) => {
      const data = payload?.payload;
      if (!data?.callId) return;
      setActiveCall((prev) => {
        if (!prev || prev.callId !== data.callId) return prev;
        return { ...prev, status: 'ended' };
      });
      setTimeout(() => setActiveCall(null), 1200);
    });

    channel.subscribe((status: string) => {
      if (__DEV__) console.log('[Call] channel', status);
    });
    callChannelRef.current = channel;

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
      callChannelRef.current = null;
    };
  }, [userProfile?.id]);

  /* ── Actions ───────────────────────────────────────────── */
  const startCall = useCallback(
    async (params: {
      chatId: string;
      type: CallType;
      peer: CallParticipant;
    }) => {
      const me = userProfile;
      if (!me?.id) return;
      const callId = `call_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      setActiveCall({
        callId,
        chatId: params.chatId,
        type: params.type,
        status: 'ringing-out',
        peer: params.peer,
        ringingAt: Date.now(),
        isOutgoing: true,
        isMuted: false,
        isSpeaker: false,
        isCameraOn: params.type === 'video',
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      try {
        await callChannelRef.current?.send({
          type: 'broadcast',
          event: 'call-offer',
          payload: {
            callId,
            chatId: params.chatId,
            type: params.type,
            to: params.peer.id,
            from: {
              id: me.id,
              name: me.fullName || 'Family Member',
              avatar: me.avatar,
              role: (me as any).role || 'parent1',
            },
          },
        });
      } catch (e) {
        console.warn('[Call] offer send failed:', e);
      }
    },
    [userProfile],
  );

  const acceptCall = useCallback(async () => {
    const call = activeCall;
    if (!call) return;
    setActiveCall((prev) => (prev ? { ...prev, status: 'connecting' } : prev));
    try {
      await callChannelRef.current?.send({
        type: 'broadcast',
        event: 'call-answer',
        payload: { callId: call.callId, to: call.peer.id },
      });
    } catch {}
    setTimeout(() => {
      setActiveCall((prev) =>
        prev && prev.callId === call.callId
          ? { ...prev, status: 'active', connectedAt: Date.now() }
          : prev,
      );
    }, 400);
    Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});
  }, [activeCall]);

  const declineCall = useCallback(async () => {
    const call = activeCall;
    if (!call) return;
    try {
      await callChannelRef.current?.send({
        type: 'broadcast',
        event: 'call-decline',
        payload: { callId: call.callId, to: call.peer.id },
      });
    } catch {}
    setActiveCall(null);
    Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Warning,
    ).catch(() => {});
  }, [activeCall]);

  const endCall = useCallback(async () => {
    const call = activeCall;
    if (!call) return;
    try {
      await callChannelRef.current?.send({
        type: 'broadcast',
        event: 'call-end',
        payload: { callId: call.callId, to: call.peer.id },
      });
    } catch {}
    setActiveCall((prev) => (prev ? { ...prev, status: 'ended' } : prev));
    setTimeout(() => setActiveCall(null), 900);
    Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});
  }, [activeCall]);

  const toggleMute = useCallback(() => {
    setActiveCall((prev) => (prev ? { ...prev, isMuted: !prev.isMuted } : prev));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const toggleSpeaker = useCallback(() => {
    setActiveCall((prev) =>
      prev ? { ...prev, isSpeaker: !prev.isSpeaker } : prev,
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const toggleCamera = useCallback(() => {
    setActiveCall((prev) =>
      prev ? { ...prev, isCameraOn: !prev.isCameraOn } : prev,
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const value = useMemo<CallContextType>(
    () => ({
      activeCall,
      waitingCall,
      startCall,
      acceptCall,
      declineCall,
      endCall,
      toggleMute,
      toggleSpeaker,
      toggleCamera,
      callDurationSec,
    }),
    [
      activeCall,
      waitingCall,
      startCall,
      acceptCall,
      declineCall,
      endCall,
      toggleMute,
      toggleSpeaker,
      toggleCamera,
      callDurationSec,
    ],
  );

  return (
    <CallContext.Provider value={value}>
      {children}
      <CallOverlay />
    </CallContext.Provider>
  );
};

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
const formatDuration = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const AvatarOrInitial: React.FC<{
  avatar?: string;
  name?: string;
  size: number;
}> = ({ avatar, name, size }) => {
  const hasImage = isImageUri(avatar);
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  if (hasImage) {
    return (
      <Image
        source={{ uri: avatar! }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{ fontSize: size * 0.45, color: DS.white, fontWeight: '800' }}
      >
        {initial}
      </Text>
    </View>
  );
};

const PulsingRing: React.FC = () => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.55);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.25, { duration: 900, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 900 }),
      ),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.05, { duration: 900 }),
        withTiming(0.55, { duration: 900 }),
      ),
      -1,
      false,
    );
  }, [opacity, scale]);
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        { borderRadius: 999, backgroundColor: DS.success },
        anim,
      ]}
    />
  );
};

/* ═══════════════════════════════════════════════════════════════
   CALL OVERLAY
   ═══════════════════════════════════════════════════════════════ */
const CallOverlay: React.FC = () => {
  const ctx = useContext(CallContext);
  const insets = useSafeAreaInsets();
  if (!ctx || !ctx.activeCall) return null;

  const {
    activeCall,
    waitingCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    toggleCamera,
    callDurationSec,
  } = ctx;

  const isVideo = activeCall.type === 'video';
  const isIncoming =
    !activeCall.isOutgoing && activeCall.status === 'ringing-in';
  const isActive =
    activeCall.status === 'active' || activeCall.status === 'connecting';
  const peerInitial =
    (activeCall.peer.name || '?').trim().charAt(0).toUpperCase() || '?';

  const statusLabel = (() => {
    switch (activeCall.status) {
      case 'ringing-out':
        return activeCall.peerOnline === false
          ? 'Waiting for answer…'
          : 'Ringing…';
      case 'ringing-in':
        return isVideo ? 'Incoming video call' : 'Incoming voice call';
      case 'connecting':
        return 'Connecting…';
      case 'active':
        return formatDuration(callDurationSec);
      case 'ended':
        return 'Call ended';
      default:
        return '';
    }
  })();

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <LinearGradient
          colors={
            isVideo
              ? ['#0c0a09', '#1e1b4b', '#0c0a09']
              : ['#0c0a09', '#111827', '#0c0a09']
          }
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          colors={[`${DS.primary}55`, 'transparent']}
          style={styles.glowTop}
          pointerEvents="none"
        />
        <LinearGradient
          colors={[`${DS.accent}44`, 'transparent']}
          style={styles.glowBottom}
          pointerEvents="none"
        />

        {/* CALL WAITING BANNER */}
        {waitingCall && (
          <View style={[styles.waitingBanner, { top: insets.top + 16 }]}>
            <BlurView
              intensity={60}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="call" size={16} color={DS.success} />
            <Text style={styles.waitingText} numberOfLines={1}>
              {waitingCall.peer.name} is calling…
            </Text>
            <Text style={styles.waitingHint}>Busy</Text>
          </View>
        )}

        <View
          style={[
            styles.overlayContent,
            {
              paddingTop: insets.top + 60,
              paddingBottom: insets.bottom + 40,
            },
          ]}
        >
          <View style={styles.peerWrap}>
            {isVideo && isActive && activeCall.isCameraOn ? (
              <View style={styles.videoPreview}>
                <BlurView
                  intensity={40}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
                <Ionicons
                  name="videocam"
                  size={64}
                  color="rgba(255,255,255,0.35)"
                />
                <Text style={styles.videoHint}>
                  Video streaming — connect react-native-webrtc
                </Text>
              </View>
            ) : (
              <View style={styles.avatarRing}>
                {activeCall.status === 'ringing-out' && <PulsingRing />}
                <LinearGradient
                  colors={[DS.primary, DS.accent]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.avatarInner}>
                  <AvatarOrInitial
                    // Pass the raw avatar through — `AvatarOrInitial`
                    // renders an <Image> for http/file/data URIs and
                    // falls back to the initial letter otherwise.
                    // NEVER render a URI as <Text>.
                    avatar={activeCall.peer.avatar}
                    name={activeCall.peer.name || peerInitial}
                    size={148}
                  />
                </View>
              </View>
            )}
          </View>

          <Text style={styles.peerName}>{activeCall.peer.name}</Text>
          <View style={styles.statusRow}>
            {activeCall.status === 'ringing-out' && (
              <ActivityIndicator size="small" color={DS.white} />
            )}
            <Text style={styles.statusLabel}>{statusLabel}</Text>
          </View>

          <View style={styles.controls}>
            {isIncoming && (
              <View style={styles.actionRow}>
                <View style={styles.controlGroup}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: DS.danger }]}
                    onPress={declineCall}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="call"
                      size={28}
                      color={DS.white}
                      style={{ transform: [{ rotate: '135deg' }] }}
                    />
                  </TouchableOpacity>
                  <Text style={styles.actionLabel}>Decline</Text>
                </View>
                <View style={styles.controlGroup}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: DS.success }]}
                    onPress={acceptCall}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="call" size={28} color={DS.white} />
                  </TouchableOpacity>
                  <Text style={styles.actionLabel}>Accept</Text>
                </View>
              </View>
            )}

            {!isIncoming && (
              <>
                <View style={styles.controlsRow}>
                  <View style={styles.controlGroup}>
                    <TouchableOpacity
                      style={[
                        styles.smallBtn,
                        {
                          backgroundColor: activeCall.isMuted
                            ? DS.warning
                            : 'rgba(255,255,255,0.12)',
                        },
                      ]}
                      onPress={toggleMute}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name={activeCall.isMuted ? 'mic-off' : 'mic'}
                        size={22}
                        color={DS.white}
                      />
                    </TouchableOpacity>
                    <Text style={styles.smallLabel}>
                      {activeCall.isMuted ? 'Unmute' : 'Mute'}
                    </Text>
                  </View>

                  <View style={styles.controlGroup}>
                    <TouchableOpacity
                      style={[
                        styles.smallBtn,
                        {
                          backgroundColor: activeCall.isSpeaker
                            ? DS.primary
                            : 'rgba(255,255,255,0.12)',
                        },
                      ]}
                      onPress={toggleSpeaker}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name={
                          activeCall.isSpeaker ? 'volume-high' : 'volume-medium'
                        }
                        size={22}
                        color={DS.white}
                      />
                    </TouchableOpacity>
                    <Text style={styles.smallLabel}>Speaker</Text>
                  </View>

                  {isVideo && (
                    <View style={styles.controlGroup}>
                      <TouchableOpacity
                        style={[
                          styles.smallBtn,
                          {
                            backgroundColor: activeCall.isCameraOn
                              ? DS.primary
                              : 'rgba(255,255,255,0.12)',
                          },
                        ]}
                        onPress={toggleCamera}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name={
                            activeCall.isCameraOn ? 'videocam' : 'videocam-off'
                          }
                          size={22}
                          color={DS.white}
                        />
                      </TouchableOpacity>
                      <Text style={styles.smallLabel}>
                        {activeCall.isCameraOn ? 'Cam On' : 'Cam Off'}
                      </Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: DS.danger }]}
                  onPress={endCall}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="call"
                    size={28}
                    color={DS.white}
                    style={{ transform: [{ rotate: '135deg' }] }}
                  />
                </TouchableOpacity>
                <Text style={styles.actionLabel}>End</Text>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

/* ═══════════════════════════════════════════════════════════════
   HOOK
   ═══════════════════════════════════════════════════════════════ */
export const useCall = (): CallContextType => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
};

/* ═══════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glowTop: {
    position: 'absolute',
    top: -140,
    left: -100,
    width: 340,
    height: 340,
    borderRadius: 170,
    opacity: 0.9,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -140,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    opacity: 0.8,
  },
  overlayContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    width: '100%',
  },
  peerWrap: { marginTop: 40, alignItems: 'center' },
  avatarRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  avatarInner: {
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: '#1c1917',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  videoPreview: {
    width: 260,
    height: 340,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30,27,75,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 8,
    padding: 16,
  },
  videoHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 8,
  },
  peerName: {
    fontSize: 26,
    fontWeight: '800',
    color: DS.white,
    marginTop: 24,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: 0.3,
  },
  controls: {
    alignItems: 'center',
    gap: 12,
    width: '100%',
    marginBottom: 20,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 320,
    marginBottom: 28,
  },
  controlGroup: { alignItems: 'center', gap: 8 },
  smallBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
  },
  actionBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
   },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: DS.white,
    letterSpacing: 0.4,
    marginTop: 6,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 320,
    marginBottom: 16,
  },
  waitingBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 10,
  },
  waitingText: {
    flex: 1,
    color: DS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  waitingHint: {
    fontSize: 11,
    fontWeight: '700',
    color: DS.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(16,185,129,0.15)',
  },
});

export default CallProvider;