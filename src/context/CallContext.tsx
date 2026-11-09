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
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from './AuthContext';
import { subscribeToProfileChanges } from './AuthContext';
import { supabase } from '@/utils/supabase';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

export type CallType = 'voice' | 'video';
export type CallStatus =
  | 'idle'          // no call
  | 'ringing-out'   // I'm calling someone
  | 'ringing-in'    // someone is calling me
  | 'connecting'    // accepted, negotiating media
  | 'active'        // call in progress
  | 'ended';        // call finished

export interface CallParticipant {
  id: string;            // profiles.userId
  name: string;
  avatar?: string;
  role?: string;
}

export interface ActiveCall {
  callId: string;        // unique id for signalling
  chatId: string;
  type: CallType;
  status: CallStatus;
  /** Who I'm calling (or who called me). */
  peer: CallParticipant;
  /** When the call actually connected (ms since epoch). */
  connectedAt?: number;
  /** When the call started ringing (ms). */
  ringingAt: number;
  /** True if I started it. */
  isOutgoing: boolean;
  isMuted: boolean;
  isSpeaker: boolean;
  isCameraOn: boolean;
}

export interface CallContextType {
  activeCall: ActiveCall | null;
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
  /** Duration of an active call in seconds (0 when not active). */
  callDurationSec: number;
}

const CallContext = createContext<CallContextType | null>(null);

/* ═══════════════════════════════════════════════════════════════
   COLOURS (matching the family chat Aura palette)
   ═══════════════════════════════════════════════════════════════ */

const DS = {
  primary: '#6366f1',
  accent: '#ec4899',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  white: '#ffffff',
  gray100: '#f5f5f4',
  gray400: '#a8a29e',
  gray700: '#44403c',
  gray900: '#1c1917',
  darkBg: '#0c0a09',
  darkCard: '#1c1917',
  darkBorder: 'rgba(255,255,255,0.06)',
};

/* ═══════════════════════════════════════════════════════════════
   PROVIDER
   ═══════════════════════════════════════════════════════════════ */

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { userProfile } = useAuth();
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [callDurationSec, setCallDurationSec] = useState(0);

  const callChannelRef = useRef<any>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  /* ── Keep the duration ticking while connected ─────────── */
  useEffect(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (
      activeCall?.status === 'active' &&
      activeCall?.connectedAt
    ) {
      setCallDurationSec(
        Math.max(0, Math.floor((Date.now() - activeCall.connectedAt) / 1000)),
      );
      durationIntervalRef.current = setInterval(() => {
        setCallDurationSec(
          Math.max(0, Math.floor((Date.now() - activeCall.connectedAt!) / 1000)),
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

  /* ── Signalling channel ──────────────────────────────────── */
  // A single Supabase broadcast channel scoped to the signed-in
  // user. It carries call-offer, call-answer, call-decline, and
  // call-end events between the two participants. WebRTC SDP/ICE
  // can also travel on this channel — see `attachPeerConnection`
  // comment at the bottom.
  useEffect(() => {
    const meId = userProfile?.id;
    if (!meId) return;

    const channel = supabase.channel(`calls-user-${meId}`, {
      config: { broadcast: { self: false } },
    });

    // Peer starts a call → show "Incoming call" for me.
    channel.on('broadcast', { event: 'call-offer' }, (payload: any) => {
      const data = payload?.payload;
      if (!data?.callId || !data?.from) return;
      // Don't double-show if we already have a call.
      setActiveCall((prev) => {
        if (prev && prev.callId !== data.callId) return prev;
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
        };
      });
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Warning,
      ).catch(() => {});
    });

    // Peer accepted my call.
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
        };
      });
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    });

    // Peer declined my call.
    channel.on('broadcast', { event: 'call-decline' }, (payload: any) => {
      const data = payload?.payload;
      if (!data?.callId) return;
      setActiveCall((prev) => {
        if (!prev || prev.callId !== data.callId) return prev;
        return { ...prev, status: 'ended' };
      });
      setTimeout(() => setActiveCall(null), 1200);
    });

    // Either side ended the call.
    channel.on('broadcast', { event: 'call-end' }, (payload: any) => {
      const data = payload?.payload;
      if (!data?.callId) return;
      setActiveCall((prev) => {
        if (!prev || prev.callId !== data.callId) return prev;
        return { ...prev, status: 'ended' };
      });
      setTimeout(() => setActiveCall(null), 1200);
    });

    channel.subscribe();
    callChannelRef.current = channel;

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
      callChannelRef.current = null;
    };
  }, [userProfile?.id]);

  /* ── Actions ─────────────────────────────────────────────── */
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
        isCameraOn: false,
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
    setActiveCall((prev) =>
      prev ? { ...prev, status: 'connecting' } : prev,
    );
    try {
      await callChannelRef.current?.send({
        type: 'broadcast',
        event: 'call-answer',
        payload: { callId: call.callId, to: call.peer.id },
      });
    } catch {}
    // Small handshake window, then active.
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
    setActiveCall((prev) =>
      prev ? { ...prev, isMuted: !prev.isMuted } : prev,
    );
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
   GLOBAL CALL OVERLAY — the actual in-app call screen
   ═══════════════════════════════════════════════════════════════ */

const formatDuration = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const CallOverlay: React.FC = () => {
  const ctx = useContext(CallContext);
  const insets = useSafeAreaInsets();
  if (!ctx || !ctx.activeCall) return null;

  const {
    activeCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    toggleCamera,
    callDurationSec,
  } = ctx;

  const isVideo = activeCall.type === 'video';
  const isIncoming = !activeCall.isOutgoing && activeCall.status === 'ringing-in';
  const isActive =
    activeCall.status === 'active' ||
    activeCall.status === 'connecting';
  const peerInitial =
    (activeCall.peer.name || '?').trim().charAt(0).toUpperCase() || '?';

  const statusLabel = (() => {
    switch (activeCall.status) {
      case 'ringing-out':
        return 'Ringing…';
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

        <View style={[styles.overlayContent, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
          {/* Peer avatar / video preview */}
          <View style={styles.peerWrap}>
            {isVideo && isActive && activeCall.isCameraOn ? (
              <View style={styles.videoPreview}>
                <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                <Ionicons name="videocam" size={64} color="rgba(255,255,255,0.35)" />
                <Text style={styles.videoHint}>
                  Video streaming — connect react-native-webrtc
                </Text>
              </View>
            ) : (
              <View style={styles.avatarRing}>
                <LinearGradient
                  colors={[DS.primary, DS.accent]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.avatarInner}>
                  {activeCall.peer.avatar ? (
                    <Text style={styles.avatarText}>
                      {activeCall.peer.avatar}
                    </Text>
                  ) : (
                    <Text style={styles.avatarText}>{peerInitial}</Text>
                  )}
                </View>
              </View>
            )}
          </View>

          <Text style={styles.peerName}>{activeCall.peer.name}</Text>
          <Text style={styles.statusLabel}>{statusLabel}</Text>

          {/* Controls */}
          <View style={styles.controls}>
            {isIncoming && (
              <>
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
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: DS.success }]}
                  onPress={acceptCall}
                  activeOpacity={0.85}
                >
                  <Ionicons name="call" size={28} color={DS.white} />
                </TouchableOpacity>
                <Text style={styles.actionLabel}>Accept</Text>
              </>
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
                        name={activeCall.isSpeaker ? 'volume-high' : 'volume-medium'}
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
  },
  avatarText: { fontSize: 72, color: DS.white, fontWeight: '800' },
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
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.72)',
    marginTop: 8,
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
});

export default CallProvider;