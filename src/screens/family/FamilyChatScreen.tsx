import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
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
import { getMemberDisplayLabel } from '../../types/roles';
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
import UniversalSpinner from '../../components/UniversalSpinner';
import {
  FamilyMessage,
  FileMetadata,
  useFamilyChat,
} from '../../context/FamilyChatContext';
import { useAuth, subscribeToProfileChanges } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useFamily } from '../../context/FamilyContext';
import { useMedia } from '../../context/MediaContext';
import { useCall } from '../../context/CallContext';

type FamilyChatScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'FamilyChat'
>;
const { width, height } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = StatusBar.currentHeight || 0;
const HEADER_TOP_PADDING =
  Platform.OS === 'ios' ? 52 : STATUS_BAR_HEIGHT + 14;

const KEYBOARD_VERTICAL_OFFSET =
  Platform.OS === 'ios' ? HEADER_TOP_PADDING + 76 : 0;

import { Text as RNText, TextInput as RNTextInput } from 'react-native';
const capScaling = (n: number) => Math.min(n, 1.35);
// @ts-ignore
RNText.defaultProps = {
  ...(RNText.defaultProps || {}),
  maxFontSizeMultiplier: capScaling(1.35),
};
// @ts-ignore
RNTextInput.defaultProps = {
  ...(RNTextInput.defaultProps || {}),
  maxFontSizeMultiplier: capScaling(1.35),
};

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
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 5,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 40,
      elevation: 12,
    },
  },
};

const HAPTIC_LIGHT = () =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const HAPTIC_MEDIUM = () =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
const HAPTIC_HEAVY = () =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
const HAPTIC_SUCCESS = () =>
  Haptics.notificationAsync(
    Haptics.NotificationFeedbackType.Success,
  ).catch(() => {});

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
const isImageUri = (v: string | undefined | null): boolean => {
  if (!v || typeof v !== 'string') return false;
  return (
    v.startsWith('http') ||
    v.startsWith('file://') ||
    v.startsWith('data:')
  );
};
const isEmoji = (v: string | undefined | null): boolean => {
  if (!v || typeof v !== 'string') return false;
  if (v.length > 4) return false;
  return /\p{Emoji}/u.test(v);
};

const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🎉', '👏', '🔥'];

/* ═══════════════════════════════════════════════════════════════════════════
   PRESSABLE SCALE
   ═══════════════════════════════════════════════════════════════════════════ */
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const PressableScale = React.memo<{
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: any;
  activeScale?: number;
}>(
  ({
    children,
    onPress,
    onLongPress,
    disabled,
    style,
    activeScale = 0.96,
  }) => {
    const scale = useSharedValue(1);
    const anim = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));
    return (
      <AnimatedTouchable
        style={[style, anim]}
        onPress={() => {
          if (!disabled) {
            HAPTIC_LIGHT();
            onPress?.();
          }
        }}
        onLongPress={onLongPress}
        onPressIn={() => {
          scale.value = withTiming(activeScale, { duration: 80 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 400 });
        }}
        activeOpacity={disabled ? 1 : 0.85}
        disabled={disabled}
      >
        {children}
      </AnimatedTouchable>
    );
  },
);

/* ═══════════════════════════════════════════════════════════════════════════
   PULSING DOT
   ═══════════════════════════════════════════════════════════════════════════ */
const PulsingDot: React.FC<{ color: string; size?: number }> = ({
  color,
  size = 8,
}) => {
  const pulse = useSharedValue(1);
  const halo = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 900 }),
        withTiming(1, { duration: 900 }),
      ),
      -1,
      true,
    );
    halo.value = withRepeat(
      withSequence(
        withTiming(1.8, { duration: 1400 }),
        withTiming(1, { duration: 1400 }),
      ),
      -1,
      true,
    );
  }, [pulse, halo]);
  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: halo.value }],
    opacity: interpolate(halo.value, [1, 1.8], [0.35, 0]),
  }));
  return (
    <View
      style={{
        width: size * 2,
        height: size * 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
          haloStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
          dotStyle,
        ]}
      />
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SAFE AVATAR
   ═══════════════════════════════════════════════════════════════════════════ */
const SafeAvatar: React.FC<{
  avatar?: string | null;
  size?: number;
  fallbackEmoji?: string;
  fallbackColor?: string;
}> = ({
  avatar,
  size = 44,
  fallbackEmoji = '👤',
  fallbackColor = DS.primary,
}) => {
  const hasImage = isImageUri(avatar);
  const hasEmoji = isEmoji(avatar);
  return (
    <View style={{ width: size, height: size }}>
      <LinearGradient
        colors={
          hasImage
            ? ['#f0f0f0', '#e0e0e0']
            : [fallbackColor + '40', fallbackColor + '20']
        }
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {hasImage ? (
          <Image
            source={{ uri: avatar! }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            resizeMode="cover"
          />
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
  onOpenCommunityChat?: () => void;
}

const PulseHeader = React.memo<PulseHeaderProps>(
  ({
    isDark,
    headerName,
    headerAvatar,
    headerStatus,
    typingText,
    isGroup,
    showUserBubbles,
    onBack,
    onInfoPress,
    onToggleUsers,
    onVideo,
    onVoice,
    onOptions,
    onOpenCommunityChat,
  }) => {
    const pulse = useSharedValue(1);
    const rotate = useSharedValue(0);
    const glow = useSharedValue(0.4);
    useEffect(() => {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 1600 }),
          withTiming(1, { duration: 1600 }),
        ),
        -1,
        true,
      );
      rotate.value = withRepeat(withTiming(360, { duration: 12000 }), -1, false);
      glow.value = withRepeat(
        withSequence(
          withTiming(0.9, { duration: 2000 }),
          withTiming(0.4, { duration: 2000 }),
        ),
        -1,
        true,
      );
    }, [pulse, rotate, glow]);
    const ringStyle = useAnimatedStyle(() => ({
      transform: [{ rotate: `${rotate.value}deg` }],
    }));
    const glowStyle = useAnimatedStyle(() => ({
      opacity: glow.value,
      transform: [{ scale: pulse.value }],
    }));

    return (
      <Animated.View entering={FadeInDown.duration(500).springify()}>
        <View
          style={[
            styles.pulseWrap,
            {
              backgroundColor: isDark ? DS.darkCard : DS.white,
              borderColor: isDark ? DS.darkBorder : DS.gray200,
            },
          ]}
        >
          <LinearGradient
            colors={
              isDark
                ? [
                    'rgba(99,102,241,0.22)',
                    'rgba(236,72,153,0.12)',
                    'rgba(139,92,246,0.06)',
                  ]
                : [
                    'rgba(99,102,241,0.10)',
                    'rgba(236,72,153,0.06)',
                    'rgba(139,92,246,0.03)',
                  ]
            }
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <LinearGradient
            colors={[`${DS.primary}${isDark ? '45' : '28'}`, 'transparent']}
            style={styles.pulseGlowL}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            pointerEvents="none"
          />
          <LinearGradient
            colors={[`${DS.accent}${isDark ? '38' : '22'}`, 'transparent']}
            style={styles.pulseGlowR}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            pointerEvents="none"
          />

          <View style={styles.pulseRow}>
            <PressableScale onPress={onBack} activeScale={0.9}>
              <View
                style={[
                  styles.pulseBackBtn,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.08)'
                      : DS.gray100,
                  },
                ]}
              >
                <Ionicons
                  name="arrow-back"
                  size={20}
                  color={isDark ? DS.white : DS.gray800}
                />
              </View>
            </PressableScale>

            <PressableScale
              onPress={onInfoPress}
              activeScale={0.94}
              style={{ flex: 1 }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: DS.space.md,
                }}
              >
                <View style={styles.pulseAvatarWrap}>
                  <Animated.View
                    style={[styles.pulseAvatarGlow, glowStyle]}
                  />
                  <Animated.View
                    style={[styles.pulseAvatarRing, ringStyle]}
                  >
                    <LinearGradient
                      colors={[DS.primary, DS.accent, DS.warning, DS.primary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </Animated.View>
                  <View
                    style={[
                      styles.pulseAvatarInner,
                      {
                        backgroundColor: isDark ? DS.darkSurface : DS.white,
                      },
                    ]}
                  >
                    <SafeAvatar
                      avatar={headerAvatar}
                      size={42}
                      fallbackEmoji={isGroup ? '👨‍👩‍👧‍👦' : '👤'}
                      fallbackColor={DS.primary}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.pulseName,
                      { color: isDark ? DS.white : DS.gray900 },
                    ]}
                    numberOfLines={1}
                  >
                    {headerName}
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      marginTop: 2,
                    }}
                  >
                    {typingText ? (
                      <>
                        <PulsingDot color={DS.accent} size={5} />
                        <Text
                          style={[styles.pulseSub, { color: DS.accent }]}
                          numberOfLines={1}
                        >
                          {typingText}
                        </Text>
                      </>
                    ) : (
                      <>
                        <PulsingDot color={DS.success} size={5} />
                        <Text
                          style={[
                            styles.pulseSub,
                            { color: isDark ? DS.gray400 : DS.gray500 },
                          ]}
                          numberOfLines={1}
                        >
                          {headerStatus}
                        </Text>
                      </>
                    )}
                  </View>
                </View>
              </View>
            </PressableScale>

            <View style={{ flexDirection: 'row', gap: 4 }}>
              <PressableScale onPress={onToggleUsers} activeScale={0.9}>
                <View
                  style={[
                    styles.pulseIconBtn,
                    {
                      backgroundColor: showUserBubbles
                        ? `${DS.primary}20`
                        : isDark
                        ? 'rgba(255,255,255,0.06)'
                        : DS.gray100,
                    },
                  ]}
                >
                  <Ionicons
                    name="people-outline"
                    size={18}
                    color={
                      showUserBubbles
                        ? DS.primary
                        : isDark
                        ? DS.gray300
                        : DS.gray600
                    }
                  />
                </View>
              </PressableScale>
              <PressableScale
                onPress={onOpenCommunityChat ?? (() => {})}
                activeScale={0.9}
              >
                <View
                  style={[
                    styles.pulseIconBtn,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.06)'
                        : DS.gray100,
                    },
                  ]}
                >
                  <Ionicons name="globe-outline" size={18} color={DS.accent} />
                </View>
              </PressableScale>
              {/* In-app VIDEO call */}
              <PressableScale onPress={onVideo} activeScale={0.9}>
                <View
                  style={[
                    styles.pulseIconBtn,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.06)'
                        : DS.gray100,
                    },
                  ]}
                >
                  <Ionicons
                    name="videocam-outline"
                    size={18}
                    color={isDark ? DS.gray300 : DS.gray600}
                  />
                </View>
              </PressableScale>
              {/* In-app VOICE call */}
              <PressableScale onPress={onVoice} activeScale={0.9}>
                <View
                  style={[
                    styles.pulseIconBtn,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.06)'
                        : DS.gray100,
                    },
                  ]}
                >
                  <Ionicons
                    name="call-outline"
                    size={18}
                    color={isDark ? DS.gray300 : DS.gray600}
                  />
                </View>
              </PressableScale>
              <PressableScale onPress={onOptions} activeScale={0.9}>
                <View
                  style={[
                    styles.pulseIconBtn,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.06)'
                        : DS.gray100,
                    },
                  ]}
                >
                  <Ionicons
                    name="ellipsis-vertical"
                    size={18}
                    color={isDark ? DS.gray300 : DS.gray600}
                  />
                </View>
              </PressableScale>
            </View>
          </View>
        </View>
      </Animated.View>
    );
  },
);

/* ═══════════════════════════════════════════════════════════════════════════
   SWEET ALERT (local — matches the family chat aesthetic)
   ═══════════════════════════════════════════════════════════════════════════ */
const SweetAlertChat: React.FC<{
  visible: boolean;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  onClose: () => void;
}> = ({ visible, type, title, message, onClose }) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const color = {
    success: DS.success,
    error: DS.danger,
    warning: DS.warning,
    info: DS.info,
  }[type];
  const icon = {
    success: 'checkmark-circle' as const,
    error: 'close-circle' as const,
    warning: 'warning' as const,
    info: 'information-circle' as const,
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

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  if (!visible) return null;

  return (
    <View style={styles.alertOverlay}>
      <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.alertContainer, anim]}>
        <LinearGradient
          colors={[color, `${color}dd`]}
          style={styles.alertGradient}
        >
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
const DeliveryStatus: React.FC<{
  status: FamilyMessage['deliveryStatus'];
}> = ({ status }) => {
  if (status === 'sending')
    return (
      <ActivityIndicator
        size={12}
        color="rgba(255,255,255,0.7)"
        style={{ marginLeft: 4 }}
      />
    );
  if (status === 'failed')
    return (
      <Ionicons
        name="alert-circle"
        size={14}
        color={DS.white}
        style={{ marginLeft: 4 }}
      />
    );
  if (status === 'sent')
    return (
      <Ionicons
        name="checkmark"
        size={14}
        color="rgba(255,255,255,0.7)"
        style={{ marginLeft: 4 }}
      />
    );
  if (status === 'delivered')
    return (
      <Ionicons
        name="checkmark-done"
        size={14}
        color="rgba(255,255,255,0.7)"
        style={{ marginLeft: 4 }}
      />
    );
  if (status === 'read')
    return (
      <Ionicons
        name="checkmark-done"
        size={14}
        color="#34b7f1"
        style={{ marginLeft: 4 }}
      />
    );
  return null;
};

/* ═══════════════════════════════════════════════════════════════════════════
   FILE BUBBLE
   ═══════════════════════════════════════════════════════════════════════════ */
const FileBubble: React.FC<{
  fileMeta?: FileMetadata;
  isMe: boolean;
  onPress: () => void;
}> = ({ fileMeta, isMe, onPress }) => {
  if (!fileMeta) return null;
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024,
      sizes = ['B', 'KB', 'MB', 'GB'];
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
      <View
        style={[
          styles.fileBubble,
          {
            backgroundColor: isMe
              ? 'rgba(255,255,255,0.15)'
              : DS.gray100,
          },
        ]}
      >
        <View
          style={[
            styles.fileIcon,
            {
              backgroundColor: isMe
                ? 'rgba(255,255,255,0.2)'
                : `${DS.primary}15`,
            },
          ]}
        >
          <Ionicons
            name={getFileIcon() as any}
            size={22}
            color={isMe ? DS.white : DS.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.fileName,
              { color: isMe ? DS.white : DS.gray900 },
            ]}
            numberOfLines={1}
          >
            {fileMeta.name}
          </Text>
          <Text
            style={[
              styles.fileSize,
              { color: isMe ? 'rgba(255,255,255,0.7)' : DS.gray500 },
            ]}
          >
            {formatFileSize(fileMeta.size)}
          </Text>
        </View>
        <Ionicons
          name="download-outline"
          size={18}
          color={isMe ? 'rgba(255,255,255,0.8)' : DS.primary}
        />
      </View>
    </PressableScale>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   USER BUBBLE
   ═══════════════════════════════════════════════════════════════════════════ */
const UserBubble: React.FC<{
  member: any;
  isDark: boolean;
  onPress: () => void;
}> = ({ member, isDark, onPress }) => {
  const roleColor =
    member.role === 'parent1'
      ? DS.primary
      : member.role === 'parent2'
      ? DS.accent
      : DS.success;
  const onlineStatus = (() => {
    if (!member.lastActive) return 'offline';
    const mins = (Date.now() - new Date(member.lastActive).getTime()) / 60000;
    if (mins < 5) return 'online';
    if (mins < 30) return 'away';
    return 'offline';
  })();
  const statusColor =
    onlineStatus === 'online'
      ? DS.success
      : onlineStatus === 'away'
      ? DS.warning
      : DS.gray400;

  return (
    <PressableScale onPress={onPress} activeScale={0.94}>
      <View style={styles.userBubble}>
        <View style={{ position: 'relative' }}>
          <SafeAvatar
            avatar={member.avatar}
            size={52}
            fallbackEmoji="👤"
            fallbackColor={roleColor}
          />
          <View
            style={[
              styles.userBubbleStatus,
              {
                backgroundColor: statusColor,
                borderColor: isDark ? DS.darkCard : DS.white,
              },
            ]}
          />
        </View>
        <Text
          style={[
            styles.userBubbleName,
            { color: isDark ? DS.white : DS.gray900 },
          ]}
          numberOfLines={1}
        >
          {member.fullName.split(' ')[0]}
        </Text>
        <Text style={[styles.userBubbleRole, { color: roleColor }]}>
          {member.relationship && member.relationship.trim()
            ? member.relationship
            : member.role === 'parent1'
            ? 'Primary'
            : member.role === 'parent2'
            ? 'Co-Parent'
            : 'Guardian'}
        </Text>
      </View>
    </PressableScale>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MESSAGE INFO MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
const MessageInfoModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  message: FamilyMessage | null;
  isDark: boolean;
  members: any[];
}> = ({ visible, onClose, message, isDark, members }) => {
  if (!message) return null;
  const sender =
    members.find((m) => m.id === message.senderId) ||
    members.find((m) => (m as any).userId === message.senderId);
  const senderDisplayName = sender?.fullName || message.senderName;
  const senderRole = sender?.role || message.senderRole;
  const readBy =
    message.readBy
      ?.map((uid) => members.find((m) => m.id === uid || m.userId === uid))
      .filter(Boolean) || [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalBackdrop}>
        <BlurView
          intensity={isDark ? 60 : 90}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          entering={FadeInUp.springify()}
          style={[
            styles.infoModal,
            { backgroundColor: isDark ? DS.darkCard : DS.white },
          ]}
        >
          <View style={styles.infoModalHeader}>
            <View
              style={[
                styles.infoModalIcon,
                { backgroundColor: `${DS.primary}15` },
              ]}
            >
              <Ionicons
                name="information-circle"
                size={28}
                color={DS.primary}
              />
            </View>
            <Text
              style={[
                styles.infoModalTitle,
                { color: isDark ? DS.white : DS.gray900 },
              ]}
            >
              Message Info
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.infoModalClose,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : DS.gray100,
                },
              ]}
            >
              <Ionicons
                name="close"
                size={20}
                color={isDark ? DS.white : DS.gray800}
              />
            </TouchableOpacity>
          </View>
          <Animated.ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: DS.space.lg }}
          >
            <View style={{ marginBottom: DS.space.lg }}>
              <Text
                style={[
                  styles.infoLabel,
                  { color: isDark ? DS.gray500 : DS.gray400 },
                ]}
              >
                SENT BY
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: DS.space.md,
                  marginTop: 6,
                }}
              >
                <SafeAvatar
                  avatar={sender?.avatar}
                  size={44}
                  fallbackEmoji="👤"
                  fallbackColor={DS.primary}
                />
                <View>
                  <Text
                    style={[
                      styles.infoValue,
                      { color: isDark ? DS.white : DS.gray900 },
                    ]}
                  >
                    {senderDisplayName}
                  </Text>
                  <Text style={[styles.infoRole, { color: DS.primary }]}>
                    {senderRole === 'parent1'
                      ? 'Primary Parent'
                      : senderRole === 'parent2'
                      ? 'Co-Parent'
                      : 'Guardian'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ marginBottom: DS.space.lg }}>
              <Text
                style={[
                  styles.infoLabel,
                  { color: isDark ? DS.gray500 : DS.gray400 },
                ]}
              >
                SENT AT
              </Text>
              <Text
                style={[
                  styles.infoValue,
                  {
                    color: isDark ? DS.white : DS.gray900,
                    marginTop: 4,
                  },
                ]}
              >
                {format(new Date(message.timestamp), 'MMMM d, yyyy • h:mm a')}
              </Text>
            </View>

            {message.isEdited && (
              <View style={{ marginBottom: DS.space.lg }}>
                <Text
                  style={[
                    styles.infoLabel,
                    { color: isDark ? DS.gray500 : DS.gray400 },
                  ]}
                >
                  EDITED
                </Text>
                <Text
                  style={[
                    styles.infoValue,
                    {
                      color: isDark ? DS.white : DS.gray900,
                      marginTop: 4,
                    },
                  ]}
                >
                  {format(
                    new Date(message.editedAt || message.timestamp),
                    'MMMM d, yyyy • h:mm a',
                  )}
                </Text>
              </View>
            )}

            <View style={{ marginBottom: DS.space.lg }}>
              <Text
                style={[
                  styles.infoLabel,
                  { color: isDark ? DS.gray500 : DS.gray400 },
                ]}
              >
                READ BY ({readBy.length})
              </Text>
              {readBy.length > 0 ? (
                readBy.map((m: any, i: number) => (
                  <View
                    key={m.id || i}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: DS.space.sm,
                      paddingVertical: 6,
                    }}
                  >
                    <SafeAvatar
                      avatar={m.avatar}
                      size={32}
                      fallbackEmoji="👤"
                      fallbackColor={DS.success}
                    />
                    <Text
                      style={[
                        styles.infoValue,
                        {
                          color: isDark ? DS.white : DS.gray900,
                          flex: 1,
                        },
                      ]}
                    >
                      {m.fullName}
                    </Text>
                    <Ionicons
                      name="checkmark-done"
                      size={16}
                      color={DS.success}
                    />
                  </View>
                ))
              ) : (
                <Text
                  style={[
                    styles.infoValue,
                    {
                      color: isDark ? DS.gray500 : DS.gray400,
                      fontStyle: 'italic',
                      marginTop: 4,
                    },
                  ]}
                >
                  Not read yet
                </Text>
              )}
            </View>

            {message.reactions && message.reactions.length > 0 && (
              <View>
                <Text
                  style={[
                    styles.infoLabel,
                    { color: isDark ? DS.gray500 : DS.gray400 },
                  ]}
                >
                  REACTIONS
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginTop: 6,
                  }}
                >
                  {message.reactions.map((r, i) => (
                    <View
                      key={i}
                      style={[
                        styles.infoReaction,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.05)'
                            : DS.gray100,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 16 }}>{r.emoji}</Text>
                      <Text
                        style={[
                          styles.infoReactionName,
                          {
                            color: isDark ? DS.gray200 : DS.gray700,
                          },
                        ]}
                      >
                        {r.userName}
                      </Text>
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
const DateSeparator: React.FC<{ date: string; isDark: boolean }> = ({
  date,
  isDark,
}) => {
  const d = new Date(date);
  const text = isToday(d)
    ? 'Today'
    : isYesterday(d)
    ? 'Yesterday'
    : isSameWeek(d, new Date())
    ? format(d, 'EEEE')
    : format(d, 'MMMM d, yyyy');
  return (
    <View style={styles.dateSep}>
      <View
        style={[
          styles.dateLine,
          { backgroundColor: isDark ? DS.darkBorder : DS.gray200 },
        ]}
      />
      <View
        style={[
          styles.dateBadge,
          { backgroundColor: isDark ? DS.darkSurface : DS.gray100 },
        ]}
      >
        <Text
          style={[
            styles.dateText,
            { color: isDark ? DS.gray400 : DS.gray500 },
          ]}
        >
          {text}
        </Text>
      </View>
      <View
        style={[
          styles.dateLine,
          { backgroundColor: isDark ? DS.darkBorder : DS.gray200 },
        ]}
      />
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
      setTimeout(() => {
        dot2.value = withSpring(1, { damping: 10 });
      }, 150);
      setTimeout(() => {
        dot3.value = withSpring(1, { damping: 10 });
      }, 300);
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

  const dotStyle = (val: any) =>
    useAnimatedStyle(() => ({
      transform: [{ translateY: val.value * -4 }],
      opacity: 0.4 + val.value * 0.6,
    }));

  return (
    <View
      style={[
        styles.typingBubble,
        { backgroundColor: isDark ? DS.darkSurface : DS.white },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Animated.View
          style={[
            styles.typingDot,
            { backgroundColor: DS.primary },
            dotStyle(dot1),
          ]}
        />
        <Animated.View
          style={[
            styles.typingDot,
            { backgroundColor: DS.primary },
            dotStyle(dot2),
          ]}
        />
        <Animated.View
          style={[
            styles.typingDot,
            { backgroundColor: DS.primary },
            dotStyle(dot3),
          ]}
        />
      </View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SOFT OPTIONS SHEET
   ═══════════════════════════════════════════════════════════════════════════ */
interface SoftOption {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  color: string;
  destructive?: boolean;
  onPress: () => void;
}

const SoftOptionsSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  options: SoftOption[];
  isDark: boolean;
}> = ({ visible, onClose, title, message, options, isDark }) => {
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 20, stiffness: 300 });
      opacity.value = withTiming(1, { duration: 180 });
    } else {
      scale.value = withTiming(0.9, { duration: 150 });
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [visible, scale, opacity]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible) return null;

  const body = (
    <>
      <View style={{ alignItems: 'center', marginBottom: 12 }}>
        <View
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.15)'
              : 'rgba(0,0,0,0.12)',
            marginBottom: 14,
          }}
        />
        <Text
          style={{
            fontSize: 18,
            fontWeight: '800',
            color: isDark ? DS.white : DS.gray900,
            textAlign: 'center',
          }}
        >
          {title}
        </Text>
        {!!message && (
          <Text
            style={{
              fontSize: 13,
              fontWeight: '500',
              marginTop: 4,
              textAlign: 'center',
              color: isDark ? DS.gray400 : DS.gray500,
            }}
          >
            {message}
          </Text>
        )}
      </View>
      <View style={{ marginTop: 6 }}>
        {options.map((opt, i) => (
          <PressableScale
            key={i}
            onPress={() => {
              onClose();
              opt.onPress();
            }}
            activeScale={0.98}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 6,
                borderBottomWidth:
                  i < options.length - 1
                    ? StyleSheet.hairlineWidth
                    : 0,
                borderBottomColor: isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(0,0,0,0.06)',
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: opt.destructive
                    ? 'rgba(239,68,68,0.12)'
                    : `${opt.color}18`,
                }}
              >
                <Ionicons
                  name={opt.icon}
                  size={18}
                  color={opt.destructive ? DS.danger : opt.color}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '700',
                    color: opt.destructive
                      ? DS.danger
                      : isDark
                      ? DS.white
                      : DS.gray900,
                  }}
                >
                  {opt.label}
                </Text>
                {!!opt.subtitle && (
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '500',
                      marginTop: 1,
                      color: isDark ? DS.gray500 : DS.gray500,
                    }}
                  >
                    {opt.subtitle}
                  </Text>
                )}
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={isDark ? DS.gray600 : DS.gray300}
              />
            </View>
          </PressableScale>
        ))}
      </View>
    </>
  );

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={{ flex: 1 }}
        onPress={onClose}
        activeOpacity={1}
      >
        <Animated.View
          style={[
            {
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 24,
              backgroundColor: 'rgba(0,0,0,0.5)',
            },
            backdropStyle,
          ]}
        >
          {Platform.OS === 'ios' ? (
            <Animated.View
              style={[{ width: '100%', maxWidth: 380 }, cardStyle]}
            >
              <BlurView
                intensity={isDark ? 60 : 90}
                tint={isDark ? 'dark' : 'light'}
                style={{
                  borderRadius: 26,
                  padding: 20,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: isDark
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(255,255,255,0.6)',
                }}
              >
                {body}
              </BlurView>
            </Animated.View>
          ) : (
            <Animated.View
              style={[
                {
                  width: '100%',
                  maxWidth: 380,
                  borderRadius: 26,
                  padding: 20,
                  backgroundColor: isDark
                    ? 'rgba(26,26,46,0.98)'
                    : 'rgba(255,255,255,0.98)',
                },
                cardStyle,
              ]}
            >
              {body}
            </Animated.View>
          )}
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MESSAGE REACTIONS
   ═══════════════════════════════════════════════════════════════════════════ */
const MessageReactions: React.FC<{
  reactions: { emoji: string; userId: string; userName: string }[];
  isMe: boolean;
  onPress: (emoji: string) => void;
  isDark: boolean;
}> = ({ reactions, isMe, onPress, isDark }) => {
  if (!reactions?.length) return null;
  const grouped = reactions.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <View
      style={[
        styles.reactionsContainer,
        isMe ? styles.reactionsRight : styles.reactionsLeft,
      ]}
    >
      {Object.entries(grouped).map(([emoji, count]) => (
        <PressableScale
          key={emoji}
          onPress={() => onPress(emoji)}
          activeScale={0.9}
        >
          <View
            style={[
              styles.reactionChip,
              {
                backgroundColor: isDark ? DS.darkSurface : DS.white,
                borderColor: isDark ? DS.darkBorder : DS.gray200,
              },
            ]}
          >
            <Text style={{ fontSize: 13 }}>{emoji}</Text>
            {count > 1 && (
              <Text
                style={[
                  styles.reactionCount,
                  { color: isDark ? DS.gray400 : DS.gray500 },
                ]}
              >
                {count}
              </Text>
            )}
          </View>
        </PressableScale>
      ))}
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   IMAGE PREVIEW MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
const ImagePreviewModal: React.FC<{
  visible: boolean;
  imageUrl: string;
  onClose: () => void;
  isDark: boolean;
}> = ({ visible, imageUrl, onClose, isDark }) => {
  const [loading, setLoading] = useState(true);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.imagePreviewOverlay}
        onPress={onClose}
        activeOpacity={1}
      >
        <BlurView
          intensity={95}
          style={StyleSheet.absoluteFill}
          tint={isDark ? 'dark' : 'light'}
        />
        <Animated.View
          entering={FadeIn}
          style={{
            width,
            height: height * 0.8,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {loading && (
            <ActivityIndicator
              size="large"
              color={DS.primary}
              style={{ position: 'absolute' }}
            />
          )}
          <Image
            source={{ uri: imageUrl }}
            style={{ width, height: height * 0.7 }}
            resizeMode="contain"
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => setLoading(false)}
          />
          <TouchableOpacity
            style={styles.imageCloseBtn}
            onPress={onClose}
          >
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
  message: FamilyMessage;
  isMe: boolean;
  isDark: boolean;
  member?: any;
  showAvatar: boolean;
  onReaction: (emoji: string) => void;
  onReply: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onInfo: () => void;
  onImagePress: (url: string) => void;
  onFilePress: (meta?: FileMetadata) => void;
  onResend: () => void;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  onAvatarPress?: (targetId: string, member: any) => void;
  showSweetAlert: (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string,
  ) => void;
}> = ({
  message,
  isMe,
  isDark,
  member,
  showAvatar,
  onReaction,
  onReply,
  onDelete,
  onEdit,
  onInfo,
  onImagePress,
  onFilePress,
  onResend,
  isFirstInGroup,
  isLastInGroup,
  onAvatarPress,
  showSweetAlert,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const roleColor =
    message.senderRole === 'parent1'
      ? DS.primary
      : message.senderRole === 'parent2'
      ? DS.accent
      : DS.success;

  const handleLongPress = () => {
    HAPTIC_HEAVY();
    scale.value = withSpring(0.98, { damping: 20 });
    setShowActions(true);
    setTimeout(() => {
      scale.value = withSpring(1);
    }, 150);
  };

  const bubbleStyle =
    message.type === 'system'
      ? null
      : isMe
      ? [
          styles.myBubble,
          { backgroundColor: DS.primary },
          isLastInGroup && styles.myBubbleLast,
        ]
      : [
          styles.theirBubble,
          {
            backgroundColor: isDark ? DS.darkSurface : DS.white,
            borderColor: isDark ? DS.darkBorder : DS.gray200,
          },
          isLastInGroup && styles.theirBubbleLast,
        ];

  return (
    <Animated.View
      entering={isMe ? SlideInRight : SlideInLeft}
      style={[
        styles.messageContainer,
        isMe ? styles.myContainer : styles.theirContainer,
      ]}
    >
      {!isMe && showAvatar && message.type !== 'system' && (
        <TouchableOpacity
          onPress={() => {
            if (!member) return;
            const targetId = member.id || (member as any).userId;
            if (targetId) {
              onAvatarPress?.(targetId, member);
            }
          }}
          style={{ marginRight: 8 }}
        >
          <SafeAvatar
            avatar={member?.avatar}
            size={32}
            fallbackEmoji="👤"
            fallbackColor={roleColor}
          />
        </TouchableOpacity>
      )}

      <View style={[!isMe && !showAvatar && { marginLeft: 40 }]}>
        {!isMe && showAvatar && message.type !== 'system' && (
          <Text style={[styles.senderName, { color: roleColor }]}>
            {message.senderName}
          </Text>
        )}

        <Animated.View style={anim}>
          <TouchableOpacity
            onLongPress={handleLongPress}
            activeOpacity={0.9}
            delayLongPress={200}
            onPress={onInfo}
          >
            <View
              style={[
                styles.bubble,
                bubbleStyle,
                message.type === 'system' && {
                  backgroundColor: 'transparent',
                },
              ]}
            >
              {message.replyTo && (
                <View
                  style={[
                    styles.replyPreview,
                    {
                      backgroundColor: isMe
                        ? 'rgba(255,255,255,0.2)'
                        : `${DS.primary}10`,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.replyLine,
                      {
                        backgroundColor: isMe
                          ? 'rgba(255,255,255,0.5)'
                          : DS.primary,
                      },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.replyName,
                        {
                          color: isMe
                            ? 'rgba(255,255,255,0.8)'
                            : DS.primary,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {message.replyToPreview || 'Replying to...'}
                    </Text>
                  </View>
                </View>
              )}

              {message.deliveryStatus === 'failed' && isMe && (
                <TouchableOpacity
                  onPress={onResend}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 6,
                  }}
                >
                  <Ionicons name="refresh" size={14} color={DS.white} />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: DS.white,
                      marginLeft: 4,
                    }}
                  >
                    Tap to retry
                  </Text>
                </TouchableOpacity>
              )}

              {message.type === 'image' && message.imageUrl ? (
                <TouchableOpacity
                  onPress={() => onImagePress(message.imageUrl!)}
                  activeOpacity={0.9}
                >
                  <View style={styles.imageContainer}>
                    {imageLoading && (
                      <View style={styles.imagePlaceholder}>
                        <ActivityIndicator
                          size="small"
                          color={isMe ? DS.white : DS.primary}
                        />
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
                <FileBubble
                  fileMeta={message.fileMetadata}
                  isMe={isMe}
                  onPress={() => onFilePress(message.fileMetadata)}
                />
              ) : message.type === 'voice' ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 6,
                  }}
                >
                  <Ionicons
                    name="play"
                    size={22}
                    color={isMe ? DS.white : DS.primary}
                  />
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 2,
                      marginHorizontal: 10,
                      height: 28,
                    }}
                  >
                    {[...Array(18)].map((_, i) => (
                      <View
                        key={i}
                        style={{
                          width: 2.5,
                          height: 8 + (i % 4) * 5,
                          borderRadius: 1.5,
                          backgroundColor: isMe
                            ? 'rgba(255,255,255,0.6)'
                            : DS.primary,
                        }}
                      />
                    ))}
                  </View>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: isMe
                        ? 'rgba(255,255,255,0.8)'
                        : DS.gray500,
                    }}
                  >
                    0:24
                  </Text>
                </View>
              ) : (
                <Text
                  style={[
                    styles.messageText,
                    {
                      color: isMe
                        ? DS.white
                        : isDark
                        ? DS.gray100
                        : DS.gray900,
                      fontStyle:
                        message.type === 'system' ? 'italic' : 'normal',
                      fontSize: message.type === 'system' ? 12 : 14,
                    },
                  ]}
                >
                  {message.content}
                </Text>
              )}

              <View style={styles.messageFooter}>
                <Text
                  style={[
                    styles.timestamp,
                    {
                      color: isMe
                        ? 'rgba(255,255,255,0.7)'
                        : isDark
                        ? DS.gray500
                        : DS.gray400,
                    },
                  ]}
                >
                  {format(new Date(message.timestamp), 'h:mm a')}
                </Text>
                {message.isEdited && (
                  <Text
                    style={[
                      styles.editedLabel,
                      {
                        color: isMe
                          ? 'rgba(255,255,255,0.6)'
                          : DS.gray400,
                      },
                    ]}
                  >
                    edited
                  </Text>
                )}
                {isMe && message.type !== 'system' && (
                  <DeliveryStatus status={message.deliveryStatus} />
                )}
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

        <MessageReactions
          reactions={message.reactions || []}
          isMe={isMe}
          onPress={onReaction}
          isDark={isDark}
        />
      </View>

      {/* Actions Modal */}
      <Modal
        visible={showActions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActions(false)}
        statusBarTranslucent
      >
        <TouchableOpacity
          style={styles.actionBackdrop}
          onPress={() => setShowActions(false)}
          activeOpacity={1}
        >
          <BlurView
            intensity={isDark ? 80 : 95}
            tint={isDark ? 'dark' : 'light'}
            style={[
              styles.actionMenu,
              {
                backgroundColor: isDark
                  ? 'rgba(30,30,35,0.95)'
                  : 'rgba(255,255,255,0.95)',
              },
            ]}
          >
            <Animated.ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[
                styles.emojiRow,
                {
                  borderBottomColor: isDark
                    ? DS.darkBorder
                    : DS.gray200,
                },
              ]}
            >
              {REACTIONS.map((emoji) => (
                <PressableScale
                  key={emoji}
                  onPress={() => {
                    onReaction(emoji);
                    setShowActions(false);
                  }}
                  activeScale={0.85}
                >
                  <View style={styles.emojiButton}>
                    <Text style={{ fontSize: 26 }}>{emoji}</Text>
                  </View>
                </PressableScale>
              ))}
            </Animated.ScrollView>

            <View style={{ paddingTop: 6 }}>
              <ActionItem
                icon="arrow-undo"
                label="Reply"
                color={DS.primary}
                onPress={() => {
                  onReply();
                  setShowActions(false);
                }}
                isDark={isDark}
              />
              {isMe && (
                <>
                  <ActionItem
                    icon="pencil"
                    label="Edit"
                    color={DS.warning}
                    onPress={() => {
                      onEdit();
                      setShowActions(false);
                    }}
                    isDark={isDark}
                  />
                  <ActionItem
                    icon="trash"
                    label="Delete"
                    color={DS.danger}
                    onPress={() => {
                      onDelete();
                      setShowActions(false);
                    }}
                    isDark={isDark}
                  />
                </>
              )}
              <ActionItem
                icon="information-circle"
                label="Info"
                color={DS.info}
                onPress={() => {
                  onInfo();
                  setShowActions(false);
                }}
                isDark={isDark}
              />
            </View>
          </BlurView>
        </TouchableOpacity>
      </Modal>
    </Animated.View>
  );
};

const ActionItem: React.FC<{
  icon: any;
  label: string;
  color: string;
  onPress: () => void;
  isDark: boolean;
}> = ({ icon, label, color, onPress, isDark }) => (
  <PressableScale onPress={onPress} activeScale={0.98}>
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          backgroundColor: `${color}15`,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text
        style={{
          fontSize: 15,
          fontWeight: '600',
          color:
            color === DS.danger
              ? DS.danger
              : isDark
              ? DS.white
              : DS.gray900,
        }}
      >
        {label}
      </Text>
    </View>
  </PressableScale>
);

/* ═══════════════════════════════════════════════════════════════════════════
   REPLY PREVIEW BAR
   ═══════════════════════════════════════════════════════════════════════════ */
const ReplyPreview: React.FC<{
  replyTo: { id: string; content: string; senderName: string } | null;
  onCancel: () => void;
  isDark: boolean;
}> = ({ replyTo, onCancel, isDark }) => {
  if (!replyTo) return null;
  return (
    <View
      style={[
        styles.replyBar,
        {
          backgroundColor: isDark
            ? 'rgba(30,30,35,0.9)'
            : 'rgba(255,255,255,0.9)',
          borderTopColor: isDark ? DS.darkBorder : DS.gray200,
        },
      ]}
    >
      <View
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
      >
        <View
          style={{
            width: 3,
            height: 32,
            borderRadius: 2,
            marginRight: 10,
            backgroundColor: DS.primary,
          }}
        />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: DS.primary,
              marginBottom: 2,
            }}
          >
            {replyTo.senderName}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: isDark ? DS.gray400 : DS.gray500,
            }}
            numberOfLines={1}
          >
            {replyTo.content}
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={onCancel} style={{ padding: 4 }}>
        <Ionicons
          name="close"
          size={18}
          color={isDark ? DS.gray500 : DS.gray400}
        />
      </TouchableOpacity>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */
export default function FamilyChatScreen({
  navigation,
  route,
}: FamilyChatScreenProps) {
  const {
    chatId: initialChatId,
    memberId,
    memberName,
    memberAvatar,
  } = route.params || {};
  const {
    getOrCreateDirectChat,
    getChatMessages,
    sendMessage,
    editMessage,
    markChatRead,
    markMessagesDelivered,
    deleteMessage,
    addReaction,
    setTypingStatus,
    getChatById,
    pickAndSendImage,
    pickAndSendFile,
    pickAndSendVoice,
    getTypingUsers,
    resendMessage,
    blockUser,
    isUserBlocked,
    setCurrentChatId,
    deleteChat,
    isChatHidden,
  } = useFamilyChat();
  const { members } = useFamily();
  const { userProfile } = useAuth();
  const { darkMode } = useCustomization();
  const insets = useSafeAreaInsets();
  // In-app calling — no dialer, no FaceTime.
  const { startCall } = useCall();

  const isDark = darkMode ?? false;

  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const showEvt =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () =>
      setKeyboardOpen(true),
    );
    const hideSub = Keyboard.addListener(hideEvt, () =>
      setKeyboardOpen(false),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const [messages, setMessages] = useState<FamilyMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [chatId, setChatId] = useState<string>(initialChatId || '');
  const [chatInfo, setChatInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    content: string;
    senderName: string;
  } | null>(null);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showUserBubbles, setShowUserBubbles] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<FamilyMessage | null>(
    null,
  );
  const [showMessageInfo, setShowMessageInfo] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [alert, setAlert] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({ visible: false, type: 'success', title: '', message: '' });
  const [showOptionsSheet, setShowOptionsSheet] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const lastMarkedCountRef = useRef<number>(-1);
  const messagesRef = useRef<FamilyMessage[]>([]);
  const chatStillExistsRef = useRef(true);

  const { subscribeToChatMessages, familyCode: activeFamilyCode } =
    useFamilyChat();

  // ── STABLE CONTEXT SNAPSHOT ────────────────────────────────
  // `useFamilyChat()` returns a NEW object every render, so every
  // function it hands back has a new identity. Capturing them once
  // via a ref keeps every useCallback below stable.
  const ctxRef = useRef<ReturnType<typeof useFamilyChat> | null>(null);
  if (!ctxRef.current) {
    ctxRef.current = {
      getOrCreateDirectChat,
      getChatMessages,
      sendMessage,
      editMessage,
      markChatRead,
      markMessagesDelivered,
      deleteMessage,
      addReaction,
      setTypingStatus,
      getChatById,
      pickAndSendImage,
      pickAndSendFile,
      pickAndSendVoice,
      getTypingUsers,
      resendMessage,
      blockUser,
      isUserBlocked,
      setCurrentChatId,
      deleteChat,
      isChatHidden,
      subscribeToChatMessages,
      familyCode: activeFamilyCode,
    } as any;
  }
  const ctx = ctxRef.current!;

  /* ─── 1. Pure helpers ─────────────────────────────────────── */
  const formatDuration = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const getMemberById = (id: string) =>
    members.find((m) => m.id === id) ||
    members.find((m: any) => m.userId === id);

  const showSweetAlert = (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string,
  ) => {
    setAlert({ visible: true, type, title, message });
  };

  /* ─── 2. Derived memos (depend only on state/context) ────── */
  const headerInfo = useMemo(() => {
    if (!chatInfo)
      return {
        name: memberName || 'Chat',
        avatar: memberAvatar || '💬',
        status: '',
      };
    if (chatInfo.type === 'group') {
      return {
        name: chatInfo.name || 'Family Group',
        avatar: chatInfo.avatar || '👨‍👩‍👧‍👦',
        status: `${chatInfo.participants?.length || 0} members`,
      };
    }
    const otherId = chatInfo.participants?.find(
      (p: string) => p !== userProfile?.id,
    );
    const member = otherId ? getMemberById(otherId) : undefined;
    const status = member
      ? getMemberDisplayLabel({
          role: member.role,
          relationship: member.relationship,
        })
      : 'Family Member';
    return {
      name: member?.fullName || memberName || 'Unknown',
      avatar: member?.avatar || memberAvatar || '👤',
      status,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatInfo, memberName, memberAvatar, userProfile, members]);

  const otherMembers = useMemo(
    () =>
      members.filter(
        (m) => m.id !== userProfile?.id && m.userId !== userProfile?.id,
      ),
    [members, userProfile],
  );

  const typingText = useMemo(() => {
    const typingUsers = getTypingUsers(chatId);
    const others = typingUsers.filter((u) => u.userId !== userProfile?.id);
    if (!others.length) return '';
    if (others.length === 1) return `${others[0].userName} is typing...`;
    return `${others.length} people are typing...`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, userProfile?.id]);

  const quickReplies = useMemo<string[]>(() => {
    const lastInbound = [...messages]
      .reverse()
      .find(
        (m) => m.senderId !== userProfile?.id && m.type === 'text',
      );
    const text = (lastInbound?.content || '').toLowerCase();
    const isOnline = (headerInfo.status || '')
      .toLowerCase()
      .includes('online');
    const role = String(
      chatInfo?.participantRoles?.[
        chatInfo?.participants?.find(
          (p: string) => p !== userProfile?.id,
        ) || ''
      ] || '',
    ).toLowerCase();
    const set = new Set<string>();
    if (!messages.length) {
      set.add(role === 'parent2' ? 'Hey co-parent! 👋' : 'Hi there! 👋');
      set.add('How are things going?');
      set.add('Sharing an update…');
    }
    if (text.includes('?')) {
      set.add('Good question — let me check');
      set.add('Yes, that works 👍');
      set.add('Not sure, will follow up');
    }
    if (text.includes('thank')) {
      set.add('Anytime! 💙');
      set.add('No problem at all');
    }
    if (text.includes('photo') || text.includes('picture')) {
      set.add('Beautiful! 📸');
      set.add('Love it!');
    }
    if (
      text.includes('sick') ||
      text.includes('fever') ||
      text.includes('hurt')
    ) {
      set.add('Oh no — is baby okay?');
      set.add('Let me know if you need anything');
    }
    if (isOnline) set.add('Calling you now…');
    set.add('👍');
    set.add('❤️');
    return Array.from(set).slice(0, 5);
  }, [messages, headerInfo.status, chatInfo, userProfile?.id]);

  const chatOptions = useMemo<SoftOption[]>(() => {
    const otherId = chatInfo?.participants?.find(
      (p: string) => p !== userProfile?.id,
    );
    const blocked = isUserBlocked(otherId || '');
    const peerName =
      headerInfo.name ||
      (chatInfo?.type === 'group'
        ? 'this group'
        : 'this conversation');

    const opts: SoftOption[] = [];

    if (otherId) {
      opts.push({
        icon: blocked ? 'checkmark-circle-outline' : 'ban-outline',
        label: blocked ? 'Unblock User' : 'Block User',
        subtitle: blocked
          ? 'Receive messages from them again'
          : 'Stop receiving messages from them',
        color: blocked ? DS.success : DS.danger,
        destructive: !blocked,
        onPress: () => {
          blockUser(otherId);
          const nowBlocked = isUserBlocked(otherId);
          showSweetAlert(
            nowBlocked ? 'warning' : 'success',
            nowBlocked ? 'Blocked' : 'Unblocked',
            nowBlocked ? 'User blocked' : 'User unblocked',
          );
        },
      });
    }

    opts.push({
      icon: 'trash-outline',
      label:
        chatInfo?.type === 'group' ? 'Delete for Me' : 'Delete Chat',
      subtitle:
        chatInfo?.type === 'group'
          ? 'Hide this group from your list'
          : 'Remove conversation permanently',
      color: DS.danger,
      destructive: true,
      onPress: () => {
        Alert.alert(
          chatInfo?.type === 'group' ? 'Delete for Me' : 'Delete Chat',
          `Permanently delete ${peerName}? This cannot be undone.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                try {
                  await deleteChat(chatId);
                  navigation.goBack();
                } catch {
                  showSweetAlert(
                    'error',
                    'Error',
                    'Failed to delete chat.',
                  );
                }
              },
            },
          ],
        );
      },
    });

    return opts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chatInfo,
    chatInfo?.type,
    chatId,
    headerInfo.name,
    userProfile?.id,
    navigation,
  ]);

  /* ─── 3. Functions ───────────────────────────────────────── */

  const refreshMessages = useCallback(() => {
    if (!chatId) return;
    const msgs = ctx.getChatMessages(chatId);
    setMessages(msgs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  const initializeChat = useCallback(async () => {
    if (initialChatId) {
      const seeded = getChatMessages(initialChatId);
      if (seeded.length > 0) {
        messagesRef.current = seeded;
        setMessages(seeded);
        setChatId(initialChatId);
        setChatInfo(getChatById(initialChatId) ?? null);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }
    } else {
      setIsLoading(true);
    }

    let targetChatId = initialChatId;
    if (!targetChatId && memberId) {
      const member = members.find((m) => m.id === memberId);
      targetChatId = await getOrCreateDirectChat(memberId, member);
    }

    if (targetChatId && isChatHidden(targetChatId)) {
      navigation.goBack();
      return;
    }

    if (targetChatId) {
      const chat = getChatById(targetChatId);
      const seed = getChatMessages(targetChatId);
      setChatInfo(chat);
      messagesRef.current = seed;
      setMessages(seed);
      setChatId(targetChatId);
    }
    setIsLoading(false);
  }, [
    initialChatId,
    memberId,
    members,
    getChatMessages,
    getChatById,
    getOrCreateDirectChat,
    isChatHidden,
    navigation,
  ]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !chatId) return;
    const otherId = chatInfo?.participants?.find(
      (p: string) => p !== userProfile?.id,
    );
    if (otherId && isUserBlocked(otherId)) {
      showSweetAlert(
        'warning',
        'Blocked',
        'You have blocked this user. Unblock to send messages.',
      );
      return;
    }
    if (!userProfile) {
      showSweetAlert('error', 'Error', 'Please sign in to send messages');
      return;
    }

    const content = inputText.trim();
    setInputText('');

    if (editingMessage) {
      await editMessage(chatId, editingMessage, content);
      setEditingMessage(null);
      showSweetAlert(
        'success',
        'Updated!',
        'Message has been edited successfully',
      );
    } else {
      await sendMessage(
        chatId,
        content,
        'text',
        undefined,
        undefined,
        replyingTo?.id,
      );
    }

    setReplyingTo(null);
    setTypingStatus(chatId, false);
    refreshMessages();
    setTimeout(
      () => flatListRef.current?.scrollToEnd({ animated: true }),
      100,
    );
    HAPTIC_SUCCESS();
  }, [
    inputText,
    chatId,
    userProfile,
    editingMessage,
    replyingTo,
    sendMessage,
    editMessage,
    setTypingStatus,
    chatInfo,
    isUserBlocked,
    refreshMessages,
  ]);

  const handleInputChange = useCallback(
    (text: string) => {
      setInputText(text);
      if (text.length > 0) {
        const now = Date.now();
        if (now - lastTypingSentRef.current > 1500) {
          lastTypingSentRef.current = now;
          setTypingStatus(chatId, true);
        }
        if (typingTimeoutRef.current)
          clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          lastTypingSentRef.current = 0;
          setTypingStatus(chatId, false);
        }, 3000);
      } else {
        lastTypingSentRef.current = 0;
        setTypingStatus(chatId, false);
      }
    },
    [chatId, setTypingStatus],
  );

  const handleImagePick = useCallback(
    async (fromCamera: boolean = false) => {
      HAPTIC_MEDIUM();
      try {
        await pickAndSendImage(chatId, fromCamera);
        refreshMessages();
        showSweetAlert(
          'success',
          'Photo Sent! 📷',
          'Your photo has been shared',
        );
      } catch {
        showSweetAlert('error', 'Error', 'Failed to send photo');
      }
    },
    [chatId, pickAndSendImage, refreshMessages],
  );

  const handleFilePick = useCallback(async () => {
    HAPTIC_MEDIUM();
    try {
      await pickAndSendFile(chatId);
      refreshMessages();
      showSweetAlert(
        'success',
        'File Sent! 📎',
        'Your file has been shared',
      );
    } catch {
      showSweetAlert('error', 'Error', 'Failed to send file');
    }
  }, [chatId, pickAndSendFile, refreshMessages]);

  const showImageSourceAlert = useCallback(() => {
    handleImagePick(false);
  }, [handleImagePick]);

  const handleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      await addReaction(chatId, messageId, emoji);
      refreshMessages();
      HAPTIC_LIGHT();
    },
    [chatId, addReaction, refreshMessages],
  );

  const handleDelete = useCallback(
    async (messageId: string) => {
      await deleteMessage(chatId, messageId);
      refreshMessages();
      showSweetAlert('success', 'Deleted', 'Message has been removed');
      HAPTIC_SUCCESS();
    },
    [chatId, deleteMessage, refreshMessages],
  );

  const handleEdit = useCallback((message: FamilyMessage) => {
    setEditingMessage(message.id);
    setInputText(message.content);
    inputRef.current?.focus();
  }, []);

  const handleReply = useCallback((message: FamilyMessage) => {
    setReplyingTo({
      id: message.id,
      content:
        message.content ||
        (message.type === 'image'
          ? '📷 Photo'
          : message.type === 'file'
          ? '📎 File'
          : '...'),
      senderName: message.senderName,
    });
    inputRef.current?.focus();
  }, []);

  const handleMessageInfo = useCallback((message: FamilyMessage) => {
    setSelectedMessage(message);
    setShowMessageInfo(true);
  }, []);

  const handleImagePress = useCallback((url: string) => {
    setPreviewImageUrl(url);
    HAPTIC_LIGHT();
  }, []);

  const handleFilePress = useCallback(async (meta?: FileMetadata) => {
    if (!meta) return;
    try {
      let localUri = meta.uri;
      if (meta.uri && meta.uri.startsWith('http')) {
        try {
          const dest = `${FileSystem.cacheDirectory}${
            meta.name || 'attachment'
          }`;
          const dl = await FileSystem.downloadAsync(meta.uri, dest);
          localUri = dl.uri;
        } catch (dlErr) {
          console.warn(
            '[FamilyChat] file download failed, opening URL:',
            dlErr,
          );
        }
      }
      const Sharing = require('expo-sharing');
      if (localUri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(localUri, {
          mimeType: meta.type || 'application/octet-stream',
          dialogTitle: meta.name || 'Open file',
        });
        return;
      }
      await Share.share({ url: localUri, title: meta.name });
    } catch {
      showSweetAlert('error', 'Error', 'Could not open file');
    }
  }, []);

  const handleResend = useCallback(
    async (messageId: string) => {
      await resendMessage(chatId, messageId);
      refreshMessages();
    },
    [chatId, resendMessage, refreshMessages],
  );

  const startRecording = useCallback(async () => {
    try {
      // Lazy-load expo-audio so the screen still renders on the web
      // (where recording isn't supported).
      const { AudioModule, RecordingPresets, useAudioRecorder } =
        require('expo-audio');
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        showSweetAlert(
          'warning',
          'Microphone',
          'Please grant microphone permission to send voice messages.',
        );
        return;
      }
      // The recorder instance is held on a ref so stopRecording can
      // see it. The actual recording work is delegated to
      // expo-audio's imperative API (`AudioModule`), which works
      // from inside a useCallback.
      const rec = new (require('expo-audio').AudioRecorder)(
        RecordingPresets.HIGH_QUALITY,
      );
      await rec.prepareToRecordAsync();
      rec.record();
      (recordingInterval as any).current = {
        recorder: rec,
      };
      setIsRecording(true);
      setRecordingDuration(0);
      HAPTIC_HEAVY();
      recordingInterval.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      console.warn('[FamilyChat] startRecording failed:', err);
      setIsRecording(false);
    }
  }, [showSweetAlert]);

  const stopRecording = useCallback(async () => {
    if (recordingInterval.current)
      clearInterval(recordingInterval.current);
    const recCtx = (recordingInterval as any).current;
    setIsRecording(false);
    setRecordingDuration(0);
    (recordingInterval as any).current = null;

    if (!chatId) return;

    try {
      let audioUri: string | null = null;
      if (recCtx?.recorder) {
        await recCtx.recorder.stop();
        audioUri = recCtx.recorder.uri ?? null;
      }
      if (audioUri) {
        // Upload to Supabase Storage and send as a voice message,
        // same pipeline as pickAndSendImage / pickAndSendFile.
        await pickAndSendVoice?.(chatId, audioUri);
      } else {
        // Fall back to the placeholder so the UI is at least
        // consistent with what the user expects to see.
        await sendMessage(chatId, '🎤 Voice message', 'voice');
      }
      refreshMessages();
      HAPTIC_SUCCESS();
    } catch (err) {
      console.warn('[FamilyChat] stopRecording failed:', err);
      showSweetAlert('error', 'Error', 'Failed to send voice message');
    }
  }, [chatId, sendMessage, refreshMessages, showSweetAlert]);

  /* ─── 4. Effects ─────────────────────────────────────────── */

  useEffect(() => {
    if (chatId) setCurrentChatId(chatId);
    return () => {
      setCurrentChatId(null);
    };
  }, [chatId, setCurrentChatId]);

  // Family-switch guard
  useEffect(() => {
    if (!chatId) return;
    const fresh = getChatById(chatId);
    const chatFamily = fresh?.familyCode;
    const switchedFamily =
      chatFamily &&
      activeFamilyCode &&
      chatFamily !== activeFamilyCode;
    if ((!fresh && !chatStillExistsRef.current) || switchedFamily) {
      if (chatStillExistsRef.current) {
        chatStillExistsRef.current = false;
        navigation.goBack();
      }
    } else if (fresh) {
      chatStillExistsRef.current = true;
    }
  }, [chatId, activeFamilyCode, getChatById, navigation]);

  // Live message sync
  useEffect(() => {
    if (!chatId || !subscribeToChatMessages) return;
    const unsub = subscribeToChatMessages(chatId, (_cid, msgs) => {
      // ── Mark incoming messages DELIVERED (double grey ticks) ──
      const meId = userProfile?.id;
      if (meId) {
        const undelivered = msgs
          .filter(
            (m) =>
              m.senderId !== meId &&
              (m.deliveryStatus === 'sent' ||
                m.deliveryStatus === 'sending'),
          )
          .map((m) => m.id);
        if (undelivered.length > 0) {
          markMessagesDelivered(chatId, undelivered);
        }
      }
      setMessages((prev) => {
        const next =
          msgs.length === 0 &&
          prev.length > 0 &&
          !chatStillExistsRef.current
            ? prev
            : msgs;
        if (!next.length) return next;
        const sorted = [...next].sort(
          (a, b) =>
            new Date(a.timestamp).getTime() -
            new Date(b.timestamp).getTime(),
        );
        const sameOrder = next.every(
          (m, i) => m.id === sorted[i]?.id,
        );
        return sameOrder ? next : sorted;
      });
      const hasUnread =
        !!meId && msgs.some((m) => !m.readBy?.includes(meId));
      if (
        hasUnread &&
        lastMarkedCountRef.current !== msgs.length
      ) {
        lastMarkedCountRef.current = msgs.length;
        markChatRead(chatId);
      }
      const prevCount = messagesRef.current.length;
      messagesRef.current = msgs;
      if (msgs.length > prevCount) {
        setTimeout(
          () => flatListRef.current?.scrollToEnd({ animated: true }),
          60,
        );
      }
    });
    return unsub;
  }, [
    chatId,
    subscribeToChatMessages,
    markChatRead,
    markMessagesDelivered,
    userProfile?.id,
  ]);

  // Chat bootstrap
  useEffect(() => {
    initializeChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialChatId, memberId]);

  // Mark the chat read as soon as we mount with a valid chatId.
  // Without this, opening the chat while it was already in the
  // background never clears the unread badge for a message that
  // arrived BEFORE this screen focused.
  useEffect(() => {
    if (!chatId) return;
    markChatRead(chatId);
  }, [chatId, markChatRead]);

  // Realtime profile-change: refresh chatInfo participants
  useEffect(() => {
    if (!chatId) return;
    const unsub = subscribeToProfileChanges(() => {
      const fresh = getChatById(chatId);
      if (fresh) setChatInfo(fresh);
    });
    return unsub;
  }, [chatId, getChatById]);

  /* ─── 5. renderMessage ──────────────────────────────────── */
  const renderMessage = useCallback(
    ({ item, index }: { item: FamilyMessage; index: number }) => {
      const isMe = item.senderId === userProfile?.id;
      const member =
        item.senderId !== 'system'
          ? getMemberById(item.senderId)
          : undefined;
      const prev = messages[index - 1];
      const next = messages[index + 1];
      const isFirst =
        !prev ||
        prev.senderId !== item.senderId ||
        new Date(item.timestamp).getTime() -
          new Date(prev.timestamp).getTime() >
          300000;
      const isLast =
        !next ||
        next.senderId !== item.senderId ||
        new Date(next.timestamp).getTime() -
          new Date(item.timestamp).getTime() >
          300000;
      const showDateSep =
        !prev ||
        new Date(prev.timestamp).toDateString() !==
          new Date(item.timestamp).toDateString();

      return (
        <View>
          {showDateSep && (
            <DateSeparator date={item.timestamp} isDark={isDark} />
          )}
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
            onAvatarPress={(targetId, senderMember) => {
              const role = String(
                senderMember?.role || '',
              ).toLowerCase();
              const mode =
                role === 'parent1'
                  ? 'parent1'
                  : role === 'parent2'
                  ? 'parent2'
                  : role === 'viewer'
                  ? 'viewer'
                  : 'guardian';
              navigation.navigate('EditGuardian', {
                memberId: targetId,
                guardianId: targetId,
                mode,
                fromChat: true,
              });
            }}
            showSweetAlert={showSweetAlert}
          />
        </View>
      );
    },
    [
      messages,
      userProfile?.id,
      isDark,
      navigation,
      // The rest are stable useCallbacks whose own deps are state-only
      // — they don't need to be listed here, and doing so was making
      // renderMessage a new function every render.
    ],
  );

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: isDark ? DS.darkBg : DS.gray50,
        }}
      >
        <UniversalSpinner
          visible
          section="main"
          size="large"
          overlay={false}
          text="Opening chat..."
          variant="aurora"
        />
      </View>
    );
  }

  /* ── Pull peer info for calling ─────────────────────────── */
  const peerForCall = (() => {
    if (!chatInfo || chatInfo.type !== 'direct') return null;
    const otherId = chatInfo.participants?.find(
      (p: string) => p !== userProfile?.id,
    );
    if (!otherId) return null;
    const memberRow =
      members.find((m: any) => m.id === otherId) ||
      members.find((m: any) => m.userId === otherId);
    return {
      id: memberRow?.userId || otherId,
      name: memberRow?.fullName || headerInfo.name,
      avatar: memberRow?.avatar || headerInfo.avatar,
      role: memberRow?.role,
    };
  })();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isDark ? DS.darkBg : DS.gray50,
      }}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <LinearGradient
        colors={
          isDark
            ? ['#0c0a09', '#12121e', '#0c0a09']
            : ['#f8faff', '#eef0f5', '#e4e8f0']
        }
        style={StyleSheet.absoluteFill}
      />

      <SweetAlertChat
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onClose={() =>
          setAlert((p) => ({ ...p, visible: false }))
        }
      />
      <MessageInfoModal
        visible={showMessageInfo}
        onClose={() => setShowMessageInfo(false)}
        message={selectedMessage}
        isDark={isDark}
        members={members}
      />
      <ImagePreviewModal
        visible={!!previewImageUrl}
        imageUrl={previewImageUrl || ''}
        onClose={() => setPreviewImageUrl(null)}
        isDark={isDark}
      />

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
              const otherId = chatInfo.participants?.find(
                (p: string) => p !== userProfile?.id,
              );
              if (!otherId) return;
              const memberRow =
                members.find((m: any) => m.id === otherId) ||
                members.find(
                  (m: any) => m.userId === otherId,
                );
              const targetId = memberRow?.id || otherId;
              const role = String(
                memberRow?.role || '',
              ).toLowerCase();
              const mode =
                role === 'parent1'
                  ? 'parent1'
                  : role === 'parent2'
                  ? 'parent2'
                  : role === 'viewer'
                  ? 'viewer'
                  : 'guardian';
              navigation.navigate('EditGuardian', {
                memberId: targetId,
                guardianId: targetId,
                mode,
                fromChat: true,
              });
            }
          }}
          onToggleUsers={() =>
            setShowUserBubbles(!showUserBubbles)
          }
          onVideo={() => {
            // ── IN-APP VIDEO CALL ───────────────────────────
            if (!peerForCall) {
              showSweetAlert(
                'info',
                'Group Video',
                'Video calls are only available in direct chats.',
              );
              return;
            }
            HAPTIC_MEDIUM();
            startCall({
              chatId,
              type: 'video',
              peer: peerForCall,
            });
          }}
          onVoice={() => {
            // ── IN-APP VOICE CALL ───────────────────────────
            if (!peerForCall) {
              showSweetAlert(
                'info',
                'Group Voice',
                'Voice calls are only available in direct chats.',
              );
              return;
            }
            HAPTIC_MEDIUM();
            startCall({
              chatId,
              type: 'voice',
              peer: peerForCall,
            });
          }}
          onOpenCommunityChat={
            chatInfo?.type === 'direct'
              ? () => {
                  const otherId = chatInfo.participants?.find(
                    (p: string) => p !== userProfile?.id,
                  );
                  if (!otherId) return;
                  HAPTIC_LIGHT();
                  const rootNav =
                    (navigation as any).getParent?.()?.getParent?.() ??
                    navigation;
                  rootNav.navigate('Chat', {
                    userId: otherId,
                    chatId: otherId,
                  });
                }
              : undefined
          }
          onOptions={() => setShowOptionsSheet(true)}
        />
      </View>

      {/* User bubbles row */}
      {showUserBubbles && (
        <Animated.View
          entering={FadeInDown}
          style={[
            styles.userBubblesRow,
            {
              borderBottomColor: isDark
                ? DS.darkBorder
                : DS.gray200,
            },
          ]}
        >
          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: DS.space.md,
              paddingVertical: 8,
            }}
          >
            {otherMembers.map((m, i) => (
              <Animated.View
                key={m.id}
                entering={FadeInDown.delay(i * 40)}
              >
                <UserBubble
                  member={m}
                  isDark={isDark}
                  onPress={() => HAPTIC_LIGHT()}
                />
              </Animated.View>
            ))}
          </Animated.ScrollView>
        </Animated.View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={KEYBOARD_VERTICAL_OFFSET}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingTop: DS.space.md,
            paddingBottom: 20,
          }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {}}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          removeClippedSubviews={false}
          style={{ flex: 1 }}
          ListEmptyComponent={
            <View
              style={{
                alignItems: 'center',
                paddingTop: 60,
                paddingHorizontal: DS.space.lg,
              }}
            >
              <View
                style={[
                  styles.emptyChatIcon,
                  { backgroundColor: `${DS.primary}15` },
                ]}
              >
                <Ionicons
                  name="chatbubbles-outline"
                  size={40}
                  color={DS.primary}
                />
              </View>
              <Text
                style={[
                  styles.emptyChatTitle,
                  { color: isDark ? DS.white : DS.gray900 },
                ]}
              >
                No messages yet
              </Text>
              <Text
                style={[
                  styles.emptyChatSub,
                  { color: isDark ? DS.gray400 : DS.gray500 },
                ]}
              >
                Start the conversation!
              </Text>
            </View>
          }
        />

        {typingText && (
          <View
            style={{
              paddingHorizontal: DS.space.lg,
              marginBottom: 4,
            }}
          >
            <TypingIndicator isDark={isDark} />
          </View>
        )}
      </KeyboardAvoidingView>

      <ReplyPreview
        replyTo={replyingTo}
        onCancel={() => setReplyingTo(null)}
        isDark={isDark}
      />

      <View style={{ flexShrink: 0 }}>
        {!inputText && !replyingTo && quickReplies.length > 0 && (
          <View style={{ height: 44, justifyContent: 'center' }}>
          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: DS.space.md,
              paddingVertical: 6,
              gap: 8,
              alignItems: 'center',
            }}
            keyboardShouldPersistTaps="handled"
          >
            {quickReplies.map((reply, i) => (
              <PressableScale
                key={i}
                onPress={() => {
                  setInputText(reply);
                  setTimeout(() => handleSend(), 50);
                }}
                activeScale={0.94}
              >
                <View
                  style={[
                    styles.quickReply,
                    {
                      backgroundColor: `${DS.primary}10`,
                      borderColor: `${DS.primary}20`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.quickReplyText,
                      { color: DS.primary },
                    ]}
                  >
                    {reply}
                  </Text>
                </View>
              </PressableScale>
            ))}
          </Animated.ScrollView>
        )}

        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: isDark
                ? 'rgba(12,10,9,0.98)'
                : 'rgba(255,255,255,0.98)',
              borderTopColor: isDark ? DS.darkBorder : DS.gray200,
              paddingBottom: keyboardOpen
                ? 8
                : Math.max(10, insets.bottom),
            },
          ]}
        >
          <TouchableOpacity
            style={styles.inputIconBtn}
            onPress={showImageSourceAlert}
          >
            <Ionicons
              name="image-outline"
              size={22}
              color={DS.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.inputIconBtn}
            onPress={handleFilePick}
          >
            <Ionicons
              name="document-attach-outline"
              size={22}
              color={DS.primary}
            />
          </TouchableOpacity>

          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.06)'
                  : DS.gray100,
                borderColor: isDark ? DS.darkBorder : DS.gray200,
              },
            ]}
          >
            <TextInput
              ref={inputRef}
              style={[
                styles.input,
                { color: isDark ? DS.white : DS.gray900 },
              ]}
              placeholder={
                editingMessage
                  ? 'Edit message...'
                  : 'Type a message...'
              }
              placeholderTextColor={
                isDark ? DS.gray500 : DS.gray400
              }
              value={inputText}
              onChangeText={handleInputChange}
              multiline
              maxLength={1000}
            />
          </View>

          {inputText ? (
            <PressableScale onPress={handleSend} activeScale={0.9}>
              <LinearGradient
                colors={[DS.primary, DS.accent]}
                style={styles.sendBtn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons
                  name="send"
                  size={18}
                  color={DS.white}
                />
              </LinearGradient>
            </PressableScale>
          ) : (
            <TouchableOpacity
              style={styles.inputIconBtn}
              onPressIn={startRecording}
              onPressOut={stopRecording}
              delayLongPress={200}
            >
              <Ionicons
                name="mic-outline"
                size={22}
                color={isRecording ? DS.danger : DS.primary}
              />
            </TouchableOpacity>
          )}
        </View>

        {isRecording && (
          <View style={styles.recordingOverlay}>
            <BlurView
              intensity={100}
              style={styles.recordingBar}
              tint="dark"
            >
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <View
                  style={[
                    styles.recordingDot,
                    { backgroundColor: DS.danger },
                  ]}
                />
                <Text style={styles.recordingText}>
                  Recording {formatDuration(recordingDuration)}
                </Text>
              </View>
              <PressableScale
                onPress={stopRecording}
                activeScale={0.9}
              >
                <View
                  style={[
                    styles.recordingStop,
                    { backgroundColor: DS.success },
                  ]}
                >
                  <Ionicons
                    name="checkmark"
                    size={22}
                    color={DS.white}
                  />
                </View>
              </PressableScale>
            </BlurView>
          </View>
        )}
      </View>

      <SoftOptionsSheet
        visible={showOptionsSheet}
        onClose={() => setShowOptionsSheet(false)}
        title={
          chatInfo?.type === 'group'
            ? 'Group Chat'
            : headerInfo.name || 'Chat'
        }
        message={
          chatInfo?.type === 'group'
            ? `${chatInfo.participants?.length || 0} members`
            : headerInfo.status
        }
        isDark={isDark}
        options={chatOptions}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES — unchanged from the working version
   ═══════════════════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  /* Pulse header */
  pulseWrap: {
    marginHorizontal: DS.space.lg,
    borderRadius: DS.radius['2xl'],
    padding: DS.space.md,
    overflow: 'hidden',
    borderWidth: 1,
    ...DS.shadow.md,
    position: 'relative',
  },
  pulseGlowL: {
    position: 'absolute',
    top: -80,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.9,
  },
  pulseGlowR: {
    position: 'absolute',
    top: -70,
    right: -70,
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.8,
  },
  pulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
  },
  pulseBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseAvatarWrap: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pulseAvatarGlow: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: `${DS.primary}35`,
  },
  pulseAvatarRing: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: 'hidden',
  },
  pulseAvatarInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  pulseSub: { fontSize: 11, fontWeight: '600', flex: 1 },
  pulseIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Alert */
  alertOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 100,
  },
  alertContainer: {
    minWidth: 260,
    maxWidth: 320,
    borderRadius: 20,
    overflow: 'hidden',
    ...DS.shadow.lg,
  },
  alertGradient: {
    alignItems: 'center',
    paddingVertical: DS.space.lg,
    paddingHorizontal: DS.space.xl,
    gap: 6,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: DS.white,
    textAlign: 'center',
    marginTop: 4,
  },
  alertMessage: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  alertDismiss: { marginTop: 6 },
  alertDismissText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },

  /* File bubble */
  fileBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    marginVertical: 2,
    gap: 10,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileName: { fontSize: 13, fontWeight: '600' },
  fileSize: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  /* User bubble */
  userBubble: {
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 3,
  },
  userBubbleStatus: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  userBubbleName: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
    maxWidth: 60,
    textAlign: 'center',
  },
  userBubbleRole: { fontSize: 9, fontWeight: '600' },

  /* Info Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  infoModal: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: DS.radius['2xl'],
    overflow: 'hidden',
    ...DS.shadow.lg,
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    padding: DS.space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  infoModalIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoModalTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  infoModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: { fontSize: 14, fontWeight: '600' },
  infoRole: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  infoReaction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  infoReactionName: { fontSize: 11, fontWeight: '600' },

  /* Date separator */
  dateSep: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DS.space.lg,
    marginVertical: DS.space.md,
  },
  dateLine: { flex: 1, height: 1 },
  dateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginHorizontal: DS.space.md,
  },
  dateText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  /* Typing */
  typingBubble: {
    alignSelf: 'flex-start',
    padding: 10,
    borderRadius: 16,
    ...DS.shadow.sm,
  },
  typingDot: { width: 7, height: 7, borderRadius: 3.5 },

  /* Reactions */
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 3,
  },
  reactionsRight: { alignSelf: 'flex-end', marginRight: 6 },
  reactionsLeft: { alignSelf: 'flex-start', marginLeft: 48 },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  reactionCount: { fontSize: 10, fontWeight: '700' },

  /* Image preview */
  imagePreviewOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  imageCloseBtn: { position: 'absolute', top: 60, right: 20 },
  imageCloseBlur: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  /* Message bubbles */
  messageContainer: {
    marginVertical: 2,
    paddingHorizontal: DS.space.lg,
    flexDirection: 'row',
  },
  myContainer: { justifyContent: 'flex-end' },
  theirContainer: { justifyContent: 'flex-start' },
  senderName: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 3,
    marginLeft: 4,
  },
  bubble: {
    maxWidth: Math.min(width * 0.78, 520),
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 16,
    flexShrink: 1,
  },
  myBubble: { borderBottomRightRadius: 4 },
  myBubbleLast: { borderBottomRightRadius: 16 },
  theirBubble: { borderBottomLeftRadius: 4, borderWidth: 1 },
  theirBubbleLast: { borderBottomLeftRadius: 16 },
  replyPreview: {
    flexDirection: 'row',
    padding: 6,
    borderRadius: 8,
    marginBottom: 6,
  },
  replyLine: { width: 3, borderRadius: 2, marginRight: 8 },
  replyName: { fontSize: 11, fontWeight: '700' },
  imageContainer: {
    width: width * 0.55,
    height: width * 0.55,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  imagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    flexShrink: 1,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 3,
    gap: 4,
  },
  timestamp: { fontSize: 10, fontWeight: '500' },
  editedLabel: { fontSize: 9, fontWeight: '500' },

  /* Actions menu */
  actionBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  actionMenu: {
    width: width * 0.85,
    maxHeight: height * 0.7,
    borderRadius: DS.radius['2xl'],
    padding: DS.space.md,
    overflow: 'hidden',
  },
  emojiRow: {
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
  },
  emojiButton: { padding: 6, marginHorizontal: 2 },

  /* Reply bar */
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: DS.space.md,
    borderTopWidth: 1,
  },

  /* User bubbles row */
  userBubblesRow: { borderBottomWidth: 1 },

  /* Empty chat */
  emptyChatIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DS.space.md,
  },
  emptyChatTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyChatSub: { fontSize: 12, fontWeight: '500' },

  /* Quick replies */
  quickReply: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  quickReplyText: { fontSize: 12, fontWeight: '600' },

  /* Input bar */
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DS.space.md,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 4,
    borderTopWidth: 1,
  },
  inputIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },      // Broadcast "delivered" so the sender's UI flips to ✓✓ within
      // ~50ms instead of waiting for the Postgres UPDATE round-trip.
      if (realtimeChannelRef.current && isSubscribedRef.current) {
        targets.forEach((id) => {
          realtimeChannelRef.current
            ?.send({
              type: 'broadcast',
              event: 'delivered',
              payload: {
                messageId: id,
                chatId,
                deviceId: deviceIdRef.current,
              },
            })
            .catch(() => {});
        });
      }

      // Persist — best effort. If the column is missing it throws
      // silently and we still show the tick locally.
      try {
        await supabase
          .from('family_messages')
          .update({
            delivery_status: 'delivered',
            updated_at: new Date().toISOString(),
          })
          .in('id', targets);
      } catch {}
    },
    [],
  );
  inputWrapper: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    borderWidth: 1,
    maxHeight: 100,
  },
  input: {
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 9,
    maxHeight: 90,
    flexShrink: 1,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    ...DS.shadow.md,
  },

  /* Recording overlay */
  recordingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: DS.space.md,
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 22,
    backgroundColor: 'rgba(30,30,46,0.95)',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  recordingText: { fontSize: 14, fontWeight: '600', color: DS.white },
  recordingStop: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});