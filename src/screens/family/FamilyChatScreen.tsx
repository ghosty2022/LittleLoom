import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, isSameWeek, isToday, isYesterday } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInLeft,
  SlideInRight,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

import type { RootStackParamList } from '../../types/navigation';
import { FamilyMessage, FileMetadata, useFamilyChat } from '../../context/FamilyChatContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useFamily } from '../../context/FamilyContext';
import { useMedia } from '../../context/MediaContext';

type FamilyChatScreenProps = NativeStackScreenProps<RootStackParamList, 'FamilyChat'>;
const { width, height } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = StatusBar.currentHeight || 0;
const HEADER_TOP_PADDING = Platform.OS === 'ios' ? 52 : STATUS_BAR_HEIGHT + 14;

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Aura
   ═══════════════════════════════════════════════════════════════════════════ */
const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  accent: '#ec4899',
  accentLight: '#f472b6',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0ea5e9',
  danger: '#ef4444',
  white: '#ffffff',
  gray50: '#fafaf9',
  gray100: '#f5f5f4',
  gray200: '#e7e5e4',
  gray300: '#d6d3d1',
  gray400: '#a8a29e',
  gray500: '#78716c',
  gray600: '#57534e',
  gray700: '#44403c',
  gray800: '#292524',
  gray900: '#1c1917',
  darkBg: '#0c0a09',
  darkSurface: '#1c1917',
  darkCard: '#292524',
  darkBorder: 'rgba(255,255,255,0.06)',
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 40, elevation: 12 },
  },
};

const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const HAPTIC_MEDIUM = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
const HAPTIC_HEAVY = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
const HAPTIC_SUCCESS = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
const isImageUri = (v: string | undefined | null): boolean => {
  if (!v || typeof v !== 'string') return false;
  return v.startsWith('http') || v.startsWith('file://') || v.startsWith('data:');
};
const isEmoji = (v: string | undefined | null): boolean => {
  if (!v || typeof v !== 'string') return false;
  if (v.length > 4) return false;
  return /\p{Emoji}/u.test(v);
};

const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🎉', '👏', '🔥'];
const QUICK_REPLIES = ['On my way!', 'Sounds good!', 'I love this!', 'Thanks for sharing'];

/* ═══════════════════════════════════════════════════════════════════════════
   GRADIENT TEXT
   ═══════════════════════════════════════════════════════════════════════════ */
const GradientText = React.memo(({ children, style, colors = ['#667eea', '#764ba2', '#f093fb'] }: {
  children: React.ReactNode; style?: any; colors?: string[];
}) => {
  const raw = typeof children === 'string' ? children : String(children ?? '');
  const letters = raw.split('');
  const interp = (c1: string, c2: string, t: number) => {
    const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
    return `rgb(${Math.round(r1 + (r2 - r1) * t)}, ${Math.round(g1 + (g2 - g1) * t)}, ${Math.round(b1 + (b2 - b1) * t)})`;
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {letters.map((l, i) => {
        const p = i / Math.max(letters.length - 1, 1);
        const ci = p * (colors.length - 1);
        const lo = Math.floor(ci), hi = Math.min(lo + 1, colors.length - 1);
        const color = interp(colors[lo] || colors[0], colors[hi] || colors[colors.length - 1], ci - lo);
        return <Text key={i} style={[style, { color }]}>{l}</Text>;
      })}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   PRESSABLE SCALE
   ═══════════════════════════════════════════════════════════════════════════ */
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const PressableScale = React.memo<{
  children: React.ReactNode; onPress?: () => void; onLongPress?: () => void;
  disabled?: boolean; style?: any; activeScale?: number;
}>(({ children, onPress, onLongPress, disabled, style, activeScale = 0.96 }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedTouchable
      style={[style, anim]}
      onPress={() => { if (!disabled) { HAPTIC_LIGHT(); onPress?.(); } }}
      onLongPress={onLongPress}
      onPressIn={() => { scale.value = withTiming(activeScale, { duration: 80 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
      activeOpacity={disabled ? 1 : 0.85}
      disabled={disabled}
    >
      {children}
    </AnimatedTouchable>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   PULSING DOT
   ═══════════════════════════════════════════════════════════════════════════ */
const PulsingDot: React.FC<{ color: string; size?: number }> = ({ color, size = 8 }) => {
  const pulse = useSharedValue(1);
  const halo = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.15, { duration: 900 }), withTiming(1, { duration: 900 })), -1, true);
    halo.value = withRepeat(withSequence(withTiming(1.8, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1, true);
  }, [pulse, halo]);
  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: halo.value }],
    opacity: interpolate(halo.value, [1, 1.8], [0.35, 0]),
  }));
  return (
    <View style={{ width: size * 2, height: size * 2, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, haloStyle]} />
      <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, dotStyle]} />
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SAFE AVATAR
   ═══════════════════════════════════════════════════════════════════════════ */
const SafeAvatar: React.FC<{
  avatar?: string | null; size?: number; fallbackEmoji?: string; fallbackColor?: string;
}> = ({ avatar, size = 44, fallbackEmoji = '👤', fallbackColor = DS.primary }) => {
  const hasImage = isImageUri(avatar);
  const hasEmoji = isEmoji(avatar);
  return (
    <View style={{ width: size, height: size }}>
      <LinearGradient
        colors={hasImage ? ['#f0f0f0', '#e0e0e0'] : [fallbackColor + '40', fallbackColor + '20']}
        style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
      >
        {hasImage ? (
          <Image source={{ uri: avatar! }} style={{ width: size, height: size, borderRadius: size / 2 }} resizeMode="cover" />
        ) : hasEmoji ? (
          <Text style={{ fontSize: size * 0.5 }}>{avatar}</Text>
        ) : (
          <Text style={{ fontSize: size * 0.5 }}>{fallbackEmoji}</Text>
        )}
      </LinearGradient>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   PULSE HEADER
   ═══════════════════════════════════════════════════════════════════════════ */
interface PulseHeaderProps {
  isDark: boolean;
  headerName: string;
  headerAvatar: string;
  headerStatus: string;
  typingText: string;
  isGroup: boolean;
  showUserBubbles: boolean;
  onBack: () => void;
  onInfoPress: () => void;
  onToggleUsers: () => void;
  onVideo: () => void;
  onVoice: () => void;
  onOptions: () => void;
}

const PulseHeader = React.memo<PulseHeaderProps>(({
  isDark, headerName, headerAvatar, headerStatus, typingText,
  isGroup, showUserBubbles, onBack, onInfoPress, onToggleUsers, onVideo, onVoice, onOptions,
}) => {
  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);
  const glow = useSharedValue(0.4);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.08, { duration: 1600 }), withTiming(1, { duration: 1600 })), -1, true);
    rotate.value = withRepeat(withTiming(360, { duration: 12000 }), -1, false);
    glow.value = withRepeat(withSequence(withTiming(0.9, { duration: 2000 }), withTiming(0.4, { duration: 2000 })), -1, true);
  }, [pulse, rotate, glow]);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: pulse.value }] }));

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()}>
      <View style={[styles.pulseWrap, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient
          colors={isDark
            ? ['rgba(99,102,241,0.22)', 'rgba(236,72,153,0.12)', 'rgba(139,92,246,0.06)']
            : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.06)', 'rgba(139,92,246,0.03)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <LinearGradient colors={[`${DS.primary}${isDark ? '45' : '28'}`, 'transparent']} style={styles.pulseGlowL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none" />
        <LinearGradient colors={[`${DS.accent}${isDark ? '38' : '22'}`, 'transparent']} style={styles.pulseGlowR} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} pointerEvents="none" />

        <View style={styles.pulseRow}>
          <PressableScale onPress={onBack} activeScale={0.9}>
            <View style={[styles.pulseBackBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : DS.gray100 }]}>
              <Ionicons name="arrow-back" size={20} color={isDark ? DS.white : DS.gray800} />
            </View>
          </PressableScale>

          <PressableScale onPress={onInfoPress} activeScale={0.94} style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.md }}>
              <View style={styles.pulseAvatarWrap}>
                <Animated.View style={[styles.pulseAvatarGlow, glowStyle]} />
                <Animated.View style={[styles.pulseAvatarRing, ringStyle]}>
                  <LinearGradient colors={[DS.primary, DS.accent, DS.warning, DS.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                </Animated.View>
                <View style={[styles.pulseAvatarInner, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
                  <SafeAvatar avatar={headerAvatar} size={42} fallbackEmoji={isGroup ? '👨‍👩‍👧‍👦' : '👤'} fallbackColor={DS.primary} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pulseName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                  {headerName}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  {typingText ? (
                    <>
                      <PulsingDot color={DS.accent} size={5} />
                      <Text style={[styles.pulseSub, { color: DS.accent }]} numberOfLines={1}>{typingText}</Text>
                    </>
                  ) : (
                    <>
                      <PulsingDot color={DS.success} size={5} />
                      <Text style={[styles.pulseSub, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>{headerStatus}</Text>
                    </>
                  )}
                </View>
              </View>
            </View>
          </PressableScale>

          <View style={{ flexDirection: 'row', gap: 4 }}>
            <PressableScale onPress={onToggleUsers} activeScale={0.9}>
              <View style={[styles.pulseIconBtn, { backgroundColor: showUserBubbles ? `${DS.primary}20` : (isDark ? 'rgba(255,255,255,0.06)' : DS.gray100) }]}>
                <Ionicons name="people-outline" size={18} color={showUserBubbles ? DS.primary : (isDark ? DS.gray300 : DS.gray600)} />
              </View>
            </PressableScale>
            <PressableScale onPress={onVideo} activeScale={0.9}>
              <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name="videocam-outline" size={18} color={isDark ? DS.gray300 : DS.gray600} />
              </View>
            </PressableScale>
            <PressableScale onPress={onVoice} activeScale={0.9}>
              <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name="call-outline" size={18} color={isDark ? DS.gray300 : DS.gray600} />
              </View>
            </PressableScale>
            <PressableScale onPress={onOptions} activeScale={0.9}>
              <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name="ellipsis-vertical" size={18} color={isDark ? DS.gray300 : DS.gray600} />
              </View>
            </PressableScale>
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   SWEET ALERT
   ═══════════════════════════════════════════════════════════════════════════ */
const SweetAlertChat: React.FC<{
  visible: boolean; type: 'success' | 'error' | 'warning' | 'info';
  title: string; message: string; onClose: () => void;
}> = ({ visible, type, title, message, onClose }) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const color = { success: DS.success, error: DS.danger, warning: DS.warning, info: DS.info }[type];
  const icon = {
    success: 'checkmark-circle' as const, error: 'close-circle' as const,
    warning: 'warning' as const, info: 'information-circle' as const,
  }[type];

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 15 });
      opacity.value = withSpring(1);
      const timer = setTimeout(() => {
        scale.value = withSpring(0);
        opacity.value = withSpring(0, {}, () => runOnJS(onClose)());
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [visible, onClose, scale, opacity]);

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  if (!visible) return null;

  return (
    <View style={styles.alertOverlay}>
      <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.alertContainer, anim]}>
        <LinearGradient colors={[color, `${color}dd`]} style={styles.alertGradient}>
          <Ionicons name={icon} size={44} color={DS.white} />
          <Text style={styles.alertTitle}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
          <TouchableOpacity style={styles.alertDismiss} onPress={onClose}>
            <Text style={styles.alertDismissText}>Tap to dismiss</Text>
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   DELIVERY STATUS
   ═══════════════════════════════════════════════════════════════════════════ */
const DeliveryStatus: React.FC<{ status: FamilyMessage['deliveryStatus'] }> = ({ status }) => {
  if (status === 'sending') return <ActivityIndicator size={12} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />;
  if (status === 'failed') return <Ionicons name="alert-circle" size={14} color={DS.white} style={{ marginLeft: 4 }} />;
  if (status === 'sent') return <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />;
  if (status === 'delivered') return <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />;
  if (status === 'read') return <Ionicons name="checkmark-done" size={14} color="#34b7f1" style={{ marginLeft: 4 }} />;
  return null;
};

/* ═══════════════════════════════════════════════════════════════════════════
   FILE BUBBLE
   ═══════════════════════════════════════════════════════════════════════════ */
const FileBubble: React.FC<{ fileMeta?: FileMetadata; isMe: boolean; onPress: () => void }> = ({ fileMeta, isMe, onPress }) => {
  if (!fileMeta) return null;
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };
  const getFileIcon = () => {
    if (fileMeta.type.startsWith('image/')) return 'image';
    if (fileMeta.type.startsWith('video/')) return 'videocam';
    if (fileMeta.type.startsWith('audio/')) return 'musical-note';
    if (fileMeta.type.includes('pdf')) return 'document-text';
    return 'document';
  };
  return (
    <PressableScale onPress={onPress} activeScale={0.98}>
      <View style={[styles.fileBubble, { backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : DS.gray100 }]}>
        <View style={[styles.fileIcon, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : `${DS.primary}15` }]}>
          <Ionicons name={getFileIcon() as any} size={22} color={isMe ? DS.white : DS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.fileName, { color: isMe ? DS.white : DS.gray900 }]} numberOfLines={1}>{fileMeta.name}</Text>
          <Text style={[styles.fileSize, { color: isMe ? 'rgba(255,255,255,0.7)' : DS.gray500 }]}>{formatFileSize(fileMeta.size)}</Text>
        </View>
        <Ionicons name="download-outline" size={18} color={isMe ? 'rgba(255,255,255,0.8)' : DS.primary} />
      </View>
    </PressableScale>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   USER BUBBLE
   ═══════════════════════════════════════════════════════════════════════════ */
const UserBubble: React.FC<{ member: any; isDark: boolean; onPress: () => void }> = ({ member, isDark, onPress }) => {
  const roleColor = member.role === 'parent1' ? DS.primary : member.role === 'parent2' ? DS.accent : DS.success;
  const onlineStatus = (() => {
    if (!member.lastActive) return 'offline';
    const mins = (Date.now() - new Date(member.lastActive).getTime()) / 60000;
    if (mins < 5) return 'online';
    if (mins < 30) return 'away';
    return 'offline';
  })();
  const statusColor = onlineStatus === 'online' ? DS.success : onlineStatus === 'away' ? DS.warning : DS.gray400;

  return (
    <PressableScale onPress={onPress} activeScale={0.94}>
      <View style={styles.userBubble}>
        <View style={{ position: 'relative' }}>
          <SafeAvatar avatar={member.avatar} size={52} fallbackEmoji="👤" fallbackColor={roleColor} />
          <View style={[styles.userBubbleStatus, { backgroundColor: statusColor, borderColor: isDark ? DS.darkCard : DS.white }]} />
        </View>
        <Text style={[styles.userBubbleName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
          {member.fullName.split(' ')[0]}
        </Text>
        <Text style={[styles.userBubbleRole, { color: roleColor }]}>
          {member.role === 'parent1' ? 'Primary' : member.role === 'parent2' ? 'Co-Parent' : 'Guardian'}
        </Text>
      </View>
    </PressableScale>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MESSAGE INFO MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
const MessageInfoModal: React.FC<{
  visible: boolean; onClose: () => void; message: FamilyMessage | null;
  isDark: boolean; members: any[];
}> = ({ visible, onClose, message, isDark, members }) => {
  if (!message) return null;
  const sender = members.find((m) => m.id === message.senderId);
  const readBy = message.readBy?.map((uid) => members.find((m) => m.id === uid || m.userId === uid)).filter(Boolean) || [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalBackdrop}>
        <BlurView intensity={isDark ? 60 : 90} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.springify()} style={[styles.infoModal, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
          <View style={styles.infoModalHeader}>
            <View style={[styles.infoModalIcon, { backgroundColor: `${DS.primary}15` }]}>
              <Ionicons name="information-circle" size={28} color={DS.primary} />
            </View>
            <Text style={[styles.infoModalTitle, { color: isDark ? DS.white : DS.gray900 }]}>Message Info</Text>
            <TouchableOpacity onPress={onClose} style={[styles.infoModalClose, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
              <Ionicons name="close" size={20} color={isDark ? DS.white : DS.gray800} />
            </TouchableOpacity>
          </View>
          <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: DS.space.lg }}>
            <View style={{ marginBottom: DS.space.lg }}>
              <Text style={[styles.infoLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>SENT BY</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.md, marginTop: 6 }}>
                <SafeAvatar avatar={sender?.avatar} size={44} fallbackEmoji="👤" fallbackColor={DS.primary} />
                <View>
                  <Text style={[styles.infoValue, { color: isDark ? DS.white : DS.gray900 }]}>{sender?.fullName || message.senderName}</Text>
                  <Text style={[styles.infoRole, { color: DS.primary }]}>
                    {sender?.role === 'parent1' ? 'Primary Parent' : sender?.role === 'parent2' ? 'Co-Parent' : 'Guardian'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ marginBottom: DS.space.lg }}>
              <Text style={[styles.infoLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>SENT AT</Text>
              <Text style={[styles.infoValue, { color: isDark ? DS.white : DS.gray900, marginTop: 4 }]}>
                {format(new Date(message.timestamp), 'MMMM d, yyyy • h:mm a')}
              </Text>
            </View>

            {message.isEdited && (
              <View style={{ marginBottom: DS.space.lg }}>
                <Text style={[styles.infoLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>EDITED</Text>
                <Text style={[styles.infoValue, { color: isDark ? DS.white : DS.gray900, marginTop: 4 }]}>
                  {format(new Date(message.editedAt || message.timestamp), 'MMMM d, yyyy • h:mm a')}
                </Text>
              </View>
            )}

            <View style={{ marginBottom: DS.space.lg }}>
              <Text style={[styles.infoLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>READ BY ({readBy.length})</Text>
              {readBy.length > 0 ? readBy.map((m: any, i: number) => (
                <View key={m.id || i} style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, paddingVertical: 6 }}>
                  <SafeAvatar avatar={m.avatar} size={32} fallbackEmoji="👤" fallbackColor={DS.success} />
                  <Text style={[styles.infoValue, { color: isDark ? DS.white : DS.gray900, flex: 1 }]}>{m.fullName}</Text>
                  <Ionicons name="checkmark-done" size={16} color={DS.success} />
                </View>
              )) : (
                <Text style={[styles.infoValue, { color: isDark ? DS.gray500 : DS.gray400, fontStyle: 'italic', marginTop: 4 }]}>Not read yet</Text>
              )}
            </View>

            {message.reactions && message.reactions.length > 0 && (
              <View>
                <Text style={[styles.infoLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>REACTIONS</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  {message.reactions.map((r, i) => (
                    <View key={i} style={[styles.infoReaction, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 }]}>
                      <Text style={{ fontSize: 16 }}>{r.emoji}</Text>
                      <Text style={[styles.infoReactionName, { color: isDark ? DS.gray200 : DS.gray700 }]}>{r.userName}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </Animated.ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   DATE SEPARATOR
   ═══════════════════════════════════════════════════════════════════════════ */
const DateSeparator: React.FC<{ date: string; isDark: boolean }> = ({ date, isDark }) => {
  const d = new Date(date);
  const text = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : isSameWeek(d, new Date()) ? format(d, 'EEEE') : format(d, 'MMMM d, yyyy');
  return (
    <View style={styles.dateSep}>
      <View style={[styles.dateLine, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
      <View style={[styles.dateBadge, { backgroundColor: isDark ? DS.darkSurface : DS.gray100 }]}>
        <Text style={[styles.dateText, { color: isDark ? DS.gray400 : DS.gray500 }]}>{text}</Text>
      </View>
      <View style={[styles.dateLine, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   TYPING INDICATOR
   ═══════════════════════════════════════════════════════════════════════════ */
const TypingIndicator: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);
  useEffect(() => {
    const animate = () => {
      dot1.value = withSpring(1, { damping: 10 });
      setTimeout(() => { dot2.value = withSpring(1, { damping: 10 }); }, 150);
      setTimeout(() => { dot3.value = withSpring(1, { damping: 10 }); }, 300);
      setTimeout(() => {
        dot1.value = withSpring(0);
        dot2.value = withSpring(0);
        dot3.value = withSpring(0);
      }, 600);
    };
    animate();
    const interval = setInterval(animate, 1200);
    return () => clearInterval(interval);
  }, [dot1, dot2, dot3]);

  const dotStyle = (val: any) => useAnimatedStyle(() => ({
    transform: [{ translateY: val.value * -4 }],
    opacity: 0.4 + val.value * 0.6,
  }));

  return (
    <View style={[styles.typingBubble, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Animated.View style={[styles.typingDot, { backgroundColor: DS.primary }, dotStyle(dot1)]} />
        <Animated.View style={[styles.typingDot, { backgroundColor: DS.primary }, dotStyle(dot2)]} />
        <Animated.View style={[styles.typingDot, { backgroundColor: DS.primary }, dotStyle(dot3)]} />
      </View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MESSAGE REACTIONS
   ═══════════════════════════════════════════════════════════════════════════ */
const MessageReactions: React.FC<{
  reactions: { emoji: string; userId: string; userName: string }[];
  isMe: boolean; onPress: (emoji: string) => void; isDark: boolean;
}> = ({ reactions, isMe, onPress, isDark }) => {
  if (!reactions?.length) return null;
  const grouped = reactions.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <View style={[styles.reactionsContainer, isMe ? styles.reactionsRight : styles.reactionsLeft]}>
      {Object.entries(grouped).map(([emoji, count]) => (
        <PressableScale key={emoji} onPress={() => onPress(emoji)} activeScale={0.9}>
          <View style={[styles.reactionChip, { backgroundColor: isDark ? DS.darkSurface : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
            <Text style={{ fontSize: 13 }}>{emoji}</Text>
            {count > 1 && <Text style={[styles.reactionCount, { color: isDark ? DS.gray400 : DS.gray500 }]}>{count}</Text>}
          </View>
        </PressableScale>
      ))}
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   IMAGE PREVIEW MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
const ImagePreviewModal: React.FC<{ visible: boolean; imageUrl: string; onClose: () => void; isDark: boolean }> = ({ visible, imageUrl, onClose, isDark }) => {
  const [loading, setLoading] = useState(true);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.imagePreviewOverlay} onPress={onClose} activeOpacity={1}>
        <BlurView intensity={95} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        <Animated.View entering={FadeIn} style={{ width, height: height * 0.8, alignItems: 'center', justifyContent: 'center' }}>
          {loading && <ActivityIndicator size="large" color={DS.primary} style={{ position: 'absolute' }} />}
          <Image
            source={{ uri: imageUrl }}
            style={{ width, height: height * 0.7 }}
            resizeMode="contain"
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => setLoading(false)}
          />
          <TouchableOpacity style={styles.imageCloseBtn} onPress={onClose}>
            <BlurView intensity={80} style={styles.imageCloseBlur}>
              <Ionicons name="close" size={22} color={DS.white} />
            </BlurView>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MESSAGE BUBBLE
   ═══════════════════════════════════════════════════════════════════════════ */
const MessageBubble: React.FC<{
  message: FamilyMessage; isMe: boolean; isDark: boolean; member?: any;
  showAvatar: boolean; onReaction: (emoji: string) => void; onReply: () => void;
  onDelete: () => void; onEdit: () => void; onInfo: () => void;
  onImagePress: (url: string) => void; onFilePress: (meta?: FileMetadata) => void;
  onResend: () => void; isFirstInGroup: boolean; isLastInGroup: boolean;
  showSweetAlert: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
}> = ({
  message, isMe, isDark, member, showAvatar, onReaction, onReply, onDelete, onEdit, onInfo,
  onImagePress, onFilePress, onResend, isFirstInGroup, isLastInGroup, showSweetAlert,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const roleColor = message.senderRole === 'parent1' ? DS.primary : message.senderRole === 'parent2' ? DS.accent : DS.success;

  const handleLongPress = () => {
    HAPTIC_HEAVY();
    scale.value = withSpring(0.98, { damping: 20 });
    setShowActions(true);
    setTimeout(() => { scale.value = withSpring(1); }, 150);
  };

  const bubbleStyle = message.type === 'system'
    ? null
    : isMe
      ? [styles.myBubble, { backgroundColor: DS.primary }, isLastInGroup && styles.myBubbleLast]
      : [styles.theirBubble, { backgroundColor: isDark ? DS.darkSurface : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }, isLastInGroup && styles.theirBubbleLast];

  return (
    <Animated.View entering={isMe ? SlideInRight : SlideInLeft} style={[styles.messageContainer, isMe ? styles.myContainer : styles.theirContainer]}>
      {!isMe && showAvatar && message.type !== 'system' && (
        <TouchableOpacity onPress={() => member && showSweetAlert('info', member.fullName, `Role: ${member.role}`)} style={{ marginRight: 8 }}>
          <SafeAvatar avatar={member?.avatar} size={32} fallbackEmoji="👤" fallbackColor={roleColor} />
        </TouchableOpacity>
      )}

      <View style={[!isMe && !showAvatar && { marginLeft: 40 }]}>
        {!isMe && showAvatar && message.type !== 'system' && (
          <Text style={[styles.senderName, { color: roleColor }]}>{message.senderName}</Text>
        )}

        <Animated.View style={anim}>
          <TouchableOpacity onLongPress={handleLongPress} activeOpacity={0.9} delayLongPress={200} onPress={onInfo}>
            <View style={[styles.bubble, bubbleStyle, message.type === 'system' && { backgroundColor: 'transparent' }]}>
              {message.replyTo && (
                <View style={[styles.replyPreview, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : `${DS.primary}10` }]}>
                  <View style={[styles.replyLine, { backgroundColor: isMe ? 'rgba(255,255,255,0.5)' : DS.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.replyName, { color: isMe ? 'rgba(255,255,255,0.8)' : DS.primary }]} numberOfLines={1}>
                      {message.replyToPreview || 'Replying to...'}
                    </Text>
                  </View>
                </View>
              )}

              {message.deliveryStatus === 'failed' && isMe && (
                <TouchableOpacity onPress={onResend} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Ionicons name="refresh" size={14} color={DS.white} />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: DS.white, marginLeft: 4 }}>Tap to retry</Text>
                </TouchableOpacity>
              )}

              {message.type === 'image' && message.imageUrl ? (
                <TouchableOpacity onPress={() => onImagePress(message.imageUrl!)} activeOpacity={0.9}>
                  <View style={styles.imageContainer}>
                    {imageLoading && (
                      <View style={styles.imagePlaceholder}>
                        <ActivityIndicator size="small" color={isMe ? DS.white : DS.primary} />
                      </View>
                    )}
                    <Image
                      source={{ uri: message.imageUrl }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                      onLoadStart={() => setImageLoading(true)}
                      onLoadEnd={() => setImageLoading(false)}
                      onError={() => setImageLoading(false)}
                    />
                  </View>
                </TouchableOpacity>
              ) : message.type === 'file' ? (
                <FileBubble fileMeta={message.fileMetadata} isMe={isMe} onPress={() => onFilePress(message.fileMetadata)} />
              ) : message.type === 'voice' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 6 }}>
                  <Ionicons name="play" size={22} color={isMe ? DS.white : DS.primary} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginHorizontal: 10, height: 28 }}>
                    {[...Array(18)].map((_, i) => (
                      <View key={i} style={{ width: 2.5, height: 8 + (i % 4) * 5, borderRadius: 1.5, backgroundColor: isMe ? 'rgba(255,255,255,0.6)' : DS.primary }} />
                    ))}
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: isMe ? 'rgba(255,255,255,0.8)' : DS.gray500 }}>0:24</Text>
                </View>
              ) : (
                <Text style={[styles.messageText, {
                  color: isMe ? DS.white : (isDark ? DS.gray100 : DS.gray900),
                  fontStyle: message.type === 'system' ? 'italic' : 'normal',
                  fontSize: message.type === 'system' ? 12 : 14,
                }]}>
                  {message.content}
                </Text>
              )}

              <View style={styles.messageFooter}>
                <Text style={[styles.timestamp, { color: isMe ? 'rgba(255,255,255,0.7)' : (isDark ? DS.gray500 : DS.gray400) }]}>
                  {format(new Date(message.timestamp), 'h:mm a')}
                </Text>
                {message.isEdited && <Text style={[styles.editedLabel, { color: isMe ? 'rgba(255,255,255,0.6)' : DS.gray400 }]}>edited</Text>}
                {isMe && message.type !== 'system' && <DeliveryStatus status={message.deliveryStatus} />}
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

        <MessageReactions reactions={message.reactions || []} isMe={isMe} onPress={onReaction} isDark={isDark} />
      </View>

      {/* Actions Modal */}
      <Modal visible={showActions} transparent animationType="fade" onRequestClose={() => setShowActions(false)} statusBarTranslucent>
        <TouchableOpacity style={styles.actionBackdrop} onPress={() => setShowActions(false)} activeOpacity={1}>
          <BlurView intensity={isDark ? 80 : 95} tint={isDark ? 'dark' : 'light'} style={[styles.actionMenu, { backgroundColor: isDark ? 'rgba(30,30,35,0.95)' : 'rgba(255,255,255,0.95)' }]}>
            <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.emojiRow, { borderBottomColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              {REACTIONS.map((emoji) => (
                <PressableScale key={emoji} onPress={() => { onReaction(emoji); setShowActions(false); }} activeScale={0.85}>
                  <View style={styles.emojiButton}>
                    <Text style={{ fontSize: 26 }}>{emoji}</Text>
                  </View>
                </PressableScale>
              ))}
            </Animated.ScrollView>

            <View style={{ paddingTop: 6 }}>
              <ActionItem icon="arrow-undo" label="Reply" color={DS.primary} onPress={() => { onReply(); setShowActions(false); }} isDark={isDark} />
              {isMe && (
                <>
                  <ActionItem icon="pencil" label="Edit" color={DS.warning} onPress={() => { onEdit(); setShowActions(false); }} isDark={isDark} />
                  <ActionItem icon="trash" label="Delete" color={DS.danger} onPress={() => { onDelete(); setShowActions(false); }} isDark={isDark} />
                </>
              )}
              <ActionItem icon="information-circle" label="Info" color={DS.info} onPress={() => { onInfo(); setShowActions(false); }} isDark={isDark} />
            </View>
          </BlurView>
        </TouchableOpacity>
      </Modal>
    </Animated.View>
  );
};

const ActionItem: React.FC<{ icon: any; label: string; color: string; onPress: () => void; isDark: boolean }> = ({ icon, label, color, onPress, isDark }) => (
  <PressableScale onPress={onPress} activeScale={0.98}>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6 }}>
      <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: `${color}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={{ fontSize: 15, fontWeight: '600', color: color === DS.danger ? DS.danger : (isDark ? DS.white : DS.gray900) }}>{label}</Text>
    </View>
  </PressableScale>
);

/* ═══════════════════════════════════════════════════════════════════════════
   REPLY PREVIEW BAR
   ═══════════════════════════════════════════════════════════════════════════ */
const ReplyPreview: React.FC<{ replyTo: { id: string; content: string; senderName: string } | null; onCancel: () => void; isDark: boolean }> = ({ replyTo, onCancel, isDark }) => {
  if (!replyTo) return null;
  return (
    <View style={[styles.replyBar, { backgroundColor: isDark ? 'rgba(30,30,35,0.9)' : 'rgba(255,255,255,0.9)', borderTopColor: isDark ? DS.darkBorder : DS.gray200 }]}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 3, height: 32, borderRadius: 2, marginRight: 10, backgroundColor: DS.primary }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: DS.primary, marginBottom: 2 }}>{replyTo.senderName}</Text>
          <Text style={{ fontSize: 12, color: isDark ? DS.gray400 : DS.gray500 }} numberOfLines={1}>{replyTo.content}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={onCancel} style={{ padding: 4 }}>
        <Ionicons name="close" size={18} color={isDark ? DS.gray500 : DS.gray400} />
      </TouchableOpacity>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */
export default function FamilyChatScreen({ navigation, route }: FamilyChatScreenProps) {
  const { chatId: initialChatId, memberId, memberName, memberAvatar } = route.params || {};
  const {
    getOrCreateDirectChat, getChatMessages, sendMessage, editMessage, markChatRead,
    deleteMessage, addReaction, setTypingStatus, getChatById, pickAndSendImage,
    pickAndSendFile, getTypingUsers, resendMessage, blockUser, isUserBlocked, setCurrentChatId,
  } = useFamilyChat();
  const { members } = useFamily();
  const { userProfile } = useAuth();
  const { pickImage } = useMedia();
  const { darkMode } = useCustomization();
  const insets = useSafeAreaInsets();

  const isDark = darkMode ?? false;

  const [messages, setMessages] = useState<FamilyMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [chatId, setChatId] = useState<string>(initialChatId || '');
  const [chatInfo, setChatInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; senderName: string } | null>(null);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showUserBubbles, setShowUserBubbles] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<FamilyMessage | null>(null);
  const [showMessageInfo, setShowMessageInfo] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ visible: boolean; type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string }>({ visible: false, type: 'success', title: '', message: '' });

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (chatId) setCurrentChatId(chatId);
    return () => { setCurrentChatId(null); };
  }, [chatId, setCurrentChatId]);

  useEffect(() => { initializeChat(); }, [initialChatId, memberId]);

  useEffect(() => {
    if (!chatId) return;
    markChatRead(chatId);
    const interval = setInterval(() => { refreshMessages(); }, 2000);
    return () => clearInterval(interval);
  }, [chatId]);

  const initializeChat = async () => {
    setIsLoading(true);
    let targetChatId = initialChatId;
    if (!targetChatId && memberId) {
      const member = members.find((m) => m.id === memberId);
      targetChatId = await getOrCreateDirectChat(memberId, member);
    }
    if (targetChatId) {
      setChatId(targetChatId);
      const chat = getChatById(targetChatId);
      setChatInfo(chat);
      refreshMessages();
    }
    setIsLoading(false);
  };

  const refreshMessages = () => {
    if (!chatId) return;
    const msgs = getChatMessages(chatId);
    setMessages(msgs);
  };

  const showSweetAlert = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    setAlert({ visible: true, type, title, message });
  };

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !chatId) return;
    const otherId = chatInfo?.participants?.find((p: string) => p !== userProfile?.id);
    if (otherId && isUserBlocked(otherId)) {
      showSweetAlert('warning', 'Blocked', 'You have blocked this user. Unblock to send messages.');
      return;
    }
    if (!userProfile) { showSweetAlert('error', 'Error', 'Please sign in to send messages'); return; }

    const content = inputText.trim();
    setInputText('');

    if (editingMessage) {
      await editMessage(chatId, editingMessage, content);
      setEditingMessage(null);
      showSweetAlert('success', 'Updated!', 'Message has been edited successfully');
    } else {
      await sendMessage(chatId, content, 'text', undefined, undefined, replyingTo?.id);
    }

    setReplyingTo(null);
    setTypingStatus(chatId, false);
    refreshMessages();
    setTimeout(() => { flatListRef.current?.scrollToEnd({ animated: true }); }, 100);
    HAPTIC_SUCCESS();
  }, [inputText, chatId, userProfile, editingMessage, replyingTo, sendMessage, editMessage, setTypingStatus, chatInfo, isUserBlocked]);

  const handleInputChange = (text: string) => {
    setInputText(text);
    if (text.length > 0) {
      setTypingStatus(chatId, true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTypingStatus(chatId, false), 3000);
    } else {
      setTypingStatus(chatId, false);
    }
  };

  const handleImagePick = async (fromCamera: boolean = false) => {
    HAPTIC_MEDIUM();
    try {
      await pickAndSendImage(chatId, fromCamera);
      refreshMessages();
      showSweetAlert('success', 'Photo Sent! 📷', 'Your photo has been shared');
    } catch { showSweetAlert('error', 'Error', 'Failed to send photo'); }
  };

  const handleFilePick = async () => {
    HAPTIC_MEDIUM();
    try {
      await pickAndSendFile(chatId);
      refreshMessages();
      showSweetAlert('success', 'File Sent! 📎', 'Your file has been shared');
    } catch { showSweetAlert('error', 'Error', 'Failed to send file'); }
  };

  const showImageSourceAlert = () => { handleImagePick(false); };

  const handleReaction = async (messageId: string, emoji: string) => {
    await addReaction(chatId, messageId, emoji);
    refreshMessages();
    HAPTIC_LIGHT();
  };

  const handleDelete = async (messageId: string) => {
    await deleteMessage(chatId, messageId);
    refreshMessages();
    showSweetAlert('success', 'Deleted', 'Message has been removed');
    HAPTIC_SUCCESS();
  };

  const handleEdit = (message: FamilyMessage) => {
    setEditingMessage(message.id);
    setInputText(message.content);
    inputRef.current?.focus();
  };

  const handleReply = (message: FamilyMessage) => {
    setReplyingTo({
      id: message.id,
      content: message.content || (message.type === 'image' ? '📷 Photo' : message.type === 'file' ? '📎 File' : '...'),
      senderName: message.senderName,
    });
    inputRef.current?.focus();
  };

  const handleMessageInfo = (message: FamilyMessage) => { setSelectedMessage(message); setShowMessageInfo(true); };
  const handleImagePress = (url: string) => { setPreviewImageUrl(url); HAPTIC_LIGHT(); };

  const handleFilePress = async (meta?: FileMetadata) => {
    if (!meta) return;
    try {
      const fileInfo = await FileSystem.getInfoAsync(meta.uri);
      if (!fileInfo.exists) { showSweetAlert('error', 'File Not Found', 'The file no longer exists'); return; }
      await Share.share({ url: meta.uri, title: meta.name });
    } catch { showSweetAlert('error', 'Error', 'Could not share file'); }
  };

  const handleResend = async (messageId: string) => {
    await resendMessage(chatId, messageId);
    refreshMessages();
  };

  const startRecording = async () => {
    try {
      setIsRecording(true);
      setRecordingDuration(0);
      HAPTIC_HEAVY();
      recordingInterval.current = setInterval(() => { setRecordingDuration((d) => d + 1); }, 1000);
    } catch {}
  };

  const stopRecording = async () => {
    if (recordingInterval.current) clearInterval(recordingInterval.current);
    setIsRecording(false);
    setRecordingDuration(0);
    if (chatId) {
      try {
        await sendMessage(chatId, '🎤 Voice message', 'voice');
        refreshMessages();
        HAPTIC_SUCCESS();
      } catch { showSweetAlert('error', 'Error', 'Failed to send voice message'); }
    }
  };

  const getMemberById = (id: string) => members.find((m) => m.id === id);

  const getTypingText = () => {
    const typingUsers = getTypingUsers(chatId);
    const others = typingUsers.filter((u) => u.userId !== userProfile?.id);
    if (!others.length) return '';
    if (others.length === 1) return `${others[0].userName} is typing...`;
    return `${others.length} people are typing...`;
  };

  const headerInfo = useMemo(() => {
    if (!chatInfo) return { name: memberName || 'Chat', avatar: memberAvatar || '💬', status: '' };
    if (chatInfo.type === 'group') {
      return { name: chatInfo.name || 'Family Group', avatar: chatInfo.avatar || '👨‍👩‍👧‍👦', status: `${chatInfo.participants?.length || 0} members` };
    }
    const otherId = chatInfo.participants?.find((p: string) => p !== userProfile?.id);
    const member = otherId ? getMemberById(otherId) : undefined;
    return {
      name: member?.fullName || memberName || 'Unknown',
      avatar: member?.avatar || memberAvatar || '👤',
      status: member?.role === 'parent1' ? 'Primary Parent' : member?.role === 'parent2' ? 'Co-Parent' : member?.role === 'guardian' ? 'Guardian' : 'Family Member',
    };
  }, [chatInfo, memberName, memberAvatar, userProfile, members]);

  const typingText = getTypingText();
  const otherMembers = useMemo(() => members.filter((m) => m.id !== userProfile?.id && m.userId !== userProfile?.id), [members, userProfile]);

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const renderMessage = ({ item, index }: { item: FamilyMessage; index: number }) => {
    const isMe = item.senderId === userProfile?.id;
    const member = item.senderId !== 'system' ? getMemberById(item.senderId) : undefined;
    const prev = messages[index - 1];
    const next = messages[index + 1];
    const isFirst = !prev || prev.senderId !== item.senderId || new Date(item.timestamp).getTime() - new Date(prev.timestamp).getTime() > 300000;
    const isLast = !next || next.senderId !== item.senderId || new Date(next.timestamp).getTime() - new Date(item.timestamp).getTime() > 300000;
    const showDateSep = !prev || new Date(prev.timestamp).toDateString() !== new Date(item.timestamp).toDateString();

    return (
      <View>
        {showDateSep && <DateSeparator date={item.timestamp} isDark={isDark} />}
        <MessageBubble
          message={item}
          isMe={isMe}
          isDark={isDark}
          member={member}
          showAvatar={isFirst}
          onReaction={(emoji) => handleReaction(item.id, emoji)}
          onReply={() => handleReply(item)}
          onDelete={() => handleDelete(item.id)}
          onEdit={() => handleEdit(item)}
          onInfo={() => handleMessageInfo(item)}
          onImagePress={handleImagePress}
          onFilePress={handleFilePress}
          onResend={() => handleResend(item.id)}
          isFirstInGroup={isFirst}
          isLastInGroup={isLast}
          showSweetAlert={showSweetAlert}
        />
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? DS.darkBg : DS.gray50, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={DS.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? DS.darkBg : DS.gray50 }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient
        colors={isDark ? ['#0c0a09', '#12121e', '#0c0a09'] : ['#f8faff', '#eef0f5', '#e4e8f0']}
        style={StyleSheet.absoluteFill}
      />

      <SweetAlertChat visible={alert.visible} type={alert.type} title={alert.title} message={alert.message} onClose={() => setAlert((p) => ({ ...p, visible: false }))} />
      <MessageInfoModal visible={showMessageInfo} onClose={() => setShowMessageInfo(false)} message={selectedMessage} isDark={isDark} members={members} />
      <ImagePreviewModal visible={!!previewImageUrl} imageUrl={previewImageUrl || ''} onClose={() => setPreviewImageUrl(null)} isDark={isDark} />

      {/* Pulse header */}
      <View style={{ paddingTop: HEADER_TOP_PADDING }}>
        <PulseHeader
          isDark={isDark}
          headerName={headerInfo.name}
          headerAvatar={headerInfo.avatar}
          headerStatus={headerInfo.status}
          typingText={typingText}
          isGroup={chatInfo?.type === 'group'}
          showUserBubbles={showUserBubbles}
          onBack={() => navigation.goBack()}
          onInfoPress={() => {
            if (chatInfo?.type === 'direct') {
              const otherId = chatInfo.participants?.find((p: string) => p !== userProfile?.id);
              if (otherId) navigation.navigate('EditGuardian', { guardianId: otherId });
            }
          }}
          onToggleUsers={() => setShowUserBubbles(!showUserBubbles)}
          onVideo={() => { HAPTIC_LIGHT(); showSweetAlert('info', 'Video Call', 'Video calling feature coming soon! 📹'); }}
          onVoice={() => { HAPTIC_LIGHT(); showSweetAlert('info', 'Voice Call', 'Voice calling feature coming soon! 📞'); }}
          onOptions={() => {
            const otherId = chatInfo?.participants?.find((p: string) => p !== userProfile?.id);
            if (otherId) {
              blockUser(otherId);
              const nowBlocked = isUserBlocked(otherId);
              showSweetAlert(nowBlocked ? 'warning' : 'success', nowBlocked ? 'Blocked' : 'Unblocked', nowBlocked ? 'User blocked' : 'User unblocked');
            }
          }}
        />
      </View>

      {/* User bubbles row */}
      {showUserBubbles && (
        <Animated.View entering={FadeInDown} style={[styles.userBubblesRow, { borderBottomColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.md, paddingVertical: 8 }}>
            {otherMembers.map((m, i) => (
              <Animated.View key={m.id} entering={FadeInDown.delay(i * 40)}>
                <UserBubble member={m} isDark={isDark} onPress={() => HAPTIC_LIGHT()} />
              </Animated.View>
            ))}
          </Animated.ScrollView>
        </Animated.View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: DS.space.md, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: DS.space.lg }}>
            <View style={[styles.emptyChatIcon, { backgroundColor: `${DS.primary}15` }]}>
              <Ionicons name="chatbubbles-outline" size={40} color={DS.primary} />
            </View>
            <Text style={[styles.emptyChatTitle, { color: isDark ? DS.white : DS.gray900 }]}>No messages yet</Text>
            <Text style={[styles.emptyChatSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Start the conversation!</Text>
          </View>
        }
      />

      {typingText && (
        <View style={{ paddingHorizontal: DS.space.lg, marginBottom: 4 }}>
          <TypingIndicator isDark={isDark} />
        </View>
      )}

      <ReplyPreview replyTo={replyingTo} onCancel={() => setReplyingTo(null)} isDark={isDark} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        {!inputText && !replyingTo && (
          <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.md, paddingVertical: 6, gap: 6 }}>
            {QUICK_REPLIES.map((reply, i) => (
              <PressableScale key={i} onPress={() => { setInputText(reply); setTimeout(() => handleSend(), 50); }} activeScale={0.94}>
                <View style={[styles.quickReply, { backgroundColor: `${DS.primary}10`, borderColor: `${DS.primary}20` }]}>
                  <Text style={[styles.quickReplyText, { color: DS.primary }]}>{reply}</Text>
                </View>
              </PressableScale>
            ))}
          </Animated.ScrollView>
        )}

        <View style={[styles.inputBar, {
          backgroundColor: isDark ? 'rgba(12,10,9,0.98)' : 'rgba(255,255,255,0.98)',
          borderTopColor: isDark ? DS.darkBorder : DS.gray200,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
        }]}>
          <TouchableOpacity style={styles.inputIconBtn} onPress={showImageSourceAlert}>
            <Ionicons name="image-outline" size={22} color={DS.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.inputIconBtn} onPress={handleFilePick}>
            <Ionicons name="document-attach-outline" size={22} color={DS.primary} />
          </TouchableOpacity>

          <View style={[styles.inputWrapper, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
              placeholder={editingMessage ? 'Edit message...' : 'Type a message...'}
              placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
              value={inputText}
              onChangeText={handleInputChange}
              multiline
              maxLength={1000}
            />
          </View>

          {inputText ? (
            <PressableScale onPress={handleSend} activeScale={0.9}>
              <LinearGradient colors={[DS.primary, DS.accent]} style={styles.sendBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="send" size={18} color={DS.white} />
              </LinearGradient>
            </PressableScale>
          ) : (
            <TouchableOpacity style={styles.inputIconBtn} onPressIn={startRecording} onPressOut={stopRecording} delayLongPress={200}>
              <Ionicons name="mic-outline" size={22} color={isRecording ? DS.danger : DS.primary} />
            </TouchableOpacity>
          )}
        </View>

        {isRecording && (
          <View style={styles.recordingOverlay}>
            <BlurView intensity={100} style={styles.recordingBar} tint="dark">
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.recordingDot, { backgroundColor: DS.danger }]} />
                <Text style={styles.recordingText}>Recording {formatDuration(recordingDuration)}</Text>
              </View>
              <PressableScale onPress={stopRecording} activeScale={0.9}>
                <View style={[styles.recordingStop, { backgroundColor: DS.success }]}>
                  <Ionicons name="checkmark" size={22} color={DS.white} />
                </View>
              </PressableScale>
            </BlurView>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  /* Pulse header */
  pulseWrap: {
    marginHorizontal: DS.space.lg, borderRadius: DS.radius['2xl'], padding: DS.space.md,
    overflow: 'hidden', borderWidth: 1, ...DS.shadow.md, position: 'relative',
  },
  pulseGlowL: { position: 'absolute', top: -80, left: -60, width: 220, height: 220, borderRadius: 110, opacity: 0.9 },
  pulseGlowR: { position: 'absolute', top: -70, right: -70, width: 200, height: 200, borderRadius: 100, opacity: 0.8 },
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md },
  pulseBackBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  pulseAvatarWrap: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  pulseAvatarGlow: { position: 'absolute', width: 58, height: 58, borderRadius: 29, backgroundColor: `${DS.primary}35` },
  pulseAvatarRing: { position: 'absolute', width: 54, height: 54, borderRadius: 27, overflow: 'hidden' },
  pulseAvatarInner: { width: 46, height: 46, borderRadius: 23, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pulseName: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  pulseSub: { fontSize: 11, fontWeight: '600', flex: 1 },
  pulseIconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  /* Alert */
  alertOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 9999, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 100 },
  alertContainer: { minWidth: 260, maxWidth: 320, borderRadius: 20, overflow: 'hidden', ...DS.shadow.lg },
  alertGradient: { alignItems: 'center', paddingVertical: DS.space.lg, paddingHorizontal: DS.space.xl, gap: 6 },
  alertTitle: { fontSize: 16, fontWeight: '800', color: DS.white, textAlign: 'center', marginTop: 4 },
  alertMessage: { fontSize: 13, color: 'rgba(255,255,255,0.9)', textAlign: 'center' },
  alertDismiss: { marginTop: 6 },
  alertDismissText: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },

  /* File bubble */
  fileBubble: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 14, marginVertical: 2, gap: 10 },
  fileIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  fileName: { fontSize: 13, fontWeight: '600' },
  fileSize: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  /* User bubble */
  userBubble: { alignItems: 'center', paddingHorizontal: 8, gap: 3 },
  userBubbleStatus: { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  userBubbleName: { fontSize: 11, fontWeight: '700', marginTop: 3, maxWidth: 60, textAlign: 'center' },
  userBubbleRole: { fontSize: 9, fontWeight: '600' },

  /* Info Modal */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  infoModal: { width: '100%', maxWidth: 400, maxHeight: '80%', borderRadius: DS.radius['2xl'], overflow: 'hidden', ...DS.shadow.lg },
  infoModalHeader: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.05)' },
  infoModalIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  infoModalTitle: { flex: 1, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  infoModalClose: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 14, fontWeight: '600' },
  infoRole: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  infoReaction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  infoReactionName: { fontSize: 11, fontWeight: '600' },

  /* Date separator */
  dateSep: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: DS.space.lg, marginVertical: DS.space.md },
  dateLine: { flex: 1, height: 1 },
  dateBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginHorizontal: DS.space.md },
  dateText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  /* Typing */
  typingBubble: { alignSelf: 'flex-start', padding: 10, borderRadius: 16, ...DS.shadow.sm },
  typingDot: { width: 7, height: 7, borderRadius: 3.5 },

  /* Reactions */
  reactionsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 },
  reactionsRight: { alignSelf: 'flex-end', marginRight: 6 },
  reactionsLeft: { alignSelf: 'flex-start', marginLeft: 48 },
  reactionChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1 },
  reactionCount: { fontSize: 10, fontWeight: '700' },

  /* Image preview */
  imagePreviewOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.9)' },
  imageCloseBtn: { position: 'absolute', top: 60, right: 20 },
  imageCloseBlur: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },

  /* Message bubbles */
  messageContainer: { marginVertical: 2, paddingHorizontal: DS.space.lg, flexDirection: 'row' },
  myContainer: { justifyContent: 'flex-end' },
  theirContainer: { justifyContent: 'flex-start' },
  senderName: { fontSize: 11, fontWeight: '700', marginBottom: 3, marginLeft: 4 },
  bubble: { maxWidth: width * 0.75, padding: 10, borderRadius: 16 },
  myBubble: { borderBottomRightRadius: 4 },
  myBubbleLast: { borderBottomRightRadius: 16 },
  theirBubble: { borderBottomLeftRadius: 4, borderWidth: 1 },
  theirBubbleLast: { borderBottomLeftRadius: 16 },
  replyPreview: { flexDirection: 'row', padding: 6, borderRadius: 8, marginBottom: 6 },
  replyLine: { width: 3, borderRadius: 2, marginRight: 8 },
  replyName: { fontSize: 11, fontWeight: '700' },
  imageContainer: { width: width * 0.55, height: width * 0.55, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.05)' },
  imagePlaceholder: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  messageText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 3, gap: 4 },
  timestamp: { fontSize: 10, fontWeight: '500' },
  editedLabel: { fontSize: 9, fontWeight: '500' },

  /* Actions menu */
  actionBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  actionMenu: { width: width * 0.85, maxHeight: height * 0.7, borderRadius: DS.radius['2xl'], padding: DS.space.md, overflow: 'hidden' },
  emojiRow: { paddingVertical: 10, paddingHorizontal: 6, borderBottomWidth: 1 },
  emojiButton: { padding: 6, marginHorizontal: 2 },

  /* Reply bar */
  replyBar: { flexDirection: 'row', alignItems: 'center', padding: DS.space.md, borderTopWidth: 1 },

  /* User bubbles row */
  userBubblesRow: { borderBottomWidth: 1 },

  /* Empty chat */
  emptyChatIcon: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.md },
  emptyChatTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  emptyChatSub: { fontSize: 12, fontWeight: '500' },

  /* Quick replies */
  quickReply: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  quickReplyText: { fontSize: 12, fontWeight: '600' },

  /* Input bar */
  inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: DS.space.md, paddingTop: 8, gap: 4, borderTopWidth: 1 },
  inputIconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  inputWrapper: { flex: 1, borderRadius: 22, paddingHorizontal: 14, borderWidth: 1, maxHeight: 100 },
  input: { fontSize: 14, fontWeight: '500', paddingVertical: 9, maxHeight: 90 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', ...DS.shadow.md },

  /* Recording overlay */
  recordingOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: DS.space.md },
  recordingBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 22, backgroundColor: 'rgba(30,30,46,0.95)' },
  recordingDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  recordingText: { fontSize: 14, fontWeight: '600', color: DS.white },
  recordingStop: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});