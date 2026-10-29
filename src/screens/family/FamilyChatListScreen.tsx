import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
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
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeInUp,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../types/navigation';
import { FamilyChat, FamilyMessage, useFamilyChat } from '../../context/FamilyChatContext';
import { FamilyMember, useFamily } from '../../context/FamilyContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';

type FamilyChatListScreenProps = NativeStackScreenProps<RootStackParamList, 'FamilyChatList'>;
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
const HAPTIC_WARNING = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});

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
  avatar?: string | null; size?: number; fallbackEmoji?: string;
  fallbackIcon?: keyof typeof Ionicons.glyphMap; fallbackColor?: string;
  showStatus?: boolean; statusColor?: string;
}> = ({ avatar, size = 60, fallbackEmoji = '👤', fallbackIcon = 'person', fallbackColor = DS.primary, showStatus = false, statusColor = DS.success }) => {
  const hasImage = isImageUri(avatar);
  const hasEmoji = isEmoji(avatar);
  return (
    <View style={{ width: size, height: size }}>
      <LinearGradient
        colors={[`${fallbackColor}20`, `${fallbackColor}40`]}
        style={{ width: size, height: size, borderRadius: size / 2.8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
      >
        {hasImage ? (
          <Image source={{ uri: avatar! }} style={{ width: size, height: size }} resizeMode="cover" />
        ) : hasEmoji ? (
          <Text style={{ fontSize: size * 0.5 }}>{avatar}</Text>
        ) : (
          <Ionicons name={fallbackIcon} size={size * 0.4} color={fallbackColor} />
        )}
      </LinearGradient>
      {showStatus && (
        <View style={{
          position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7,
          backgroundColor: statusColor, borderWidth: 2, borderColor: DS.white,
        }} />
      )}
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SWEET ALERT
   ═══════════════════════════════════════════════════════════════════════════ */
const SweetAlert = ({ visible, type, title, message, onClose }: {
  visible: boolean; type: 'success' | 'error' | 'warning' | 'info';
  title: string; message: string; onClose: () => void;
}) => {
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
   PULSE HEADER
   ═══════════════════════════════════════════════════════════════════════════ */
interface PulseHeaderProps {
  isDark: boolean;
  chatCount: number;
  unreadCount: number;
  onlineCount: number;
  showSearch: boolean;
  searchQuery: string;
  onSearchChange: (t: string) => void;
  onToggleSearch: () => void;
  onBack: () => void;
  onShareCode: () => void;
  onNewGroup: () => void;
}

const PulseHeader = React.memo<PulseHeaderProps>(({
  isDark, chatCount, unreadCount, onlineCount, showSearch, searchQuery,
  onSearchChange, onToggleSearch, onBack, onShareCode, onNewGroup,
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

        {showSearch ? (
          <View style={styles.searchRow}>
            <PressableScale onPress={onBack} activeScale={0.9}>
              <View style={[styles.pulseBackBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : DS.gray100 }]}>
                <Ionicons name="arrow-back" size={18} color={isDark ? DS.white : DS.gray800} />
              </View>
            </PressableScale>
            <View style={[styles.searchInner, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <Ionicons name="search" size={16} color={isDark ? DS.gray500 : DS.gray400} />
              <TextInput
                style={[styles.searchInput, { color: isDark ? DS.white : DS.gray900 }]}
                placeholder="Search chats..."
                placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
                value={searchQuery}
                onChangeText={onSearchChange}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => onSearchChange('')}>
                  <Ionicons name="close-circle" size={16} color={isDark ? DS.gray500 : DS.gray400} />
                </TouchableOpacity>
              )}
            </View>
            <PressableScale onPress={onToggleSearch} activeScale={0.9}>
              <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name="close" size={18} color={isDark ? DS.gray300 : DS.gray600} />
              </View>
            </PressableScale>
          </View>
        ) : (
          <>
            <View style={styles.pulseRow}>
              <PressableScale onPress={onBack} activeScale={0.9}>
                <View style={[styles.pulseBackBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : DS.gray100 }]}>
                  <Ionicons name="arrow-back" size={20} color={isDark ? DS.white : DS.gray800} />
                </View>
              </PressableScale>

              <View style={styles.pulseIconWrap}>
                <Animated.View style={[styles.pulseIconGlow, glowStyle]} />
                <Animated.View style={[styles.pulseIconRing, ringStyle]}>
                  <LinearGradient colors={[DS.primary, DS.accent, DS.warning, DS.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                </Animated.View>
                <View style={[styles.pulseIconInner, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
                  <Ionicons name="chatbubbles" size={22} color={DS.primary} />
                </View>
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.pulseTitle}>
                    FAMILY CHAT
                  </GradientText>
                  {unreadCount > 0 && (
                    <View style={[styles.pulseLivePill, { backgroundColor: `${DS.danger}18` }]}>
                      <PulsingDot color={DS.danger} size={5} />
                      <Text style={[styles.pulseLiveText, { color: DS.danger }]}>{unreadCount}</Text>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                  <View style={[styles.pulseMiniDot, { backgroundColor: DS.success }]} />
                  <Text style={[styles.pulseSub, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
                    {chatCount} chat{chatCount !== 1 ? 's' : ''} · {onlineCount} online
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 4 }}>
                <PressableScale onPress={onToggleSearch} activeScale={0.9}>
                  <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                    <Ionicons name="search" size={18} color={isDark ? DS.gray300 : DS.gray600} />
                  </View>
                </PressableScale>
                <PressableScale onPress={onShareCode} activeScale={0.9}>
                  <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                    <Ionicons name="person-add" size={18} color={isDark ? DS.gray300 : DS.gray600} />
                  </View>
                </PressableScale>
              </View>
            </View>

            {/* Action strip */}
            <View style={styles.pulseActions}>
              <PressableScale onPress={onNewGroup} activeScale={0.96} haptic-styles={{}}>
                <LinearGradient colors={[DS.primary, DS.accent]} style={styles.pulseActionPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Ionicons name="add-circle" size={16} color={DS.white} />
                  <Text style={styles.pulseActionPrimaryText}>New Group</Text>
                </LinearGradient>
              </PressableScale>
              <PressableScale onPress={onShareCode} activeScale={0.96} style={{ flex: 1 }}>
                <View style={[styles.pulseActionSecondary, { borderColor: isDark ? DS.darkBorder : DS.gray300, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.white }]}>
                  <Ionicons name="share-outline" size={14} color={isDark ? DS.gray300 : DS.gray700} />
                  <Text style={[styles.pulseActionSecondaryText, { color: isDark ? DS.gray300 : DS.gray700 }]}>Share Code</Text>
                </View>
              </PressableScale>
            </View>
          </>
        )}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION HEADER
   ═══════════════════════════════════════════════════════════════════════════ */
const SectionHeader = ({ title, subtitle, icon, color = DS.primary, action }: {
  title: string; subtitle?: string; icon?: keyof typeof Ionicons.glyphMap;
  color?: string; action?: React.ReactNode;
}) => (
  <View style={styles.sectionHeader}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm }}>
      {icon && (
        <View style={[styles.sectionIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={15} color={color} />
        </View>
      )}
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSub}>{subtitle}</Text>}
      </View>
    </View>
    {action}
  </View>
);

/* ═══════════════════════════════════════════════════════════════════════════
   USER BUBBLE
   ═══════════════════════════════════════════════════════════════════════════ */
const UserBubble: React.FC<{ member: FamilyMember; isDark: boolean; onPress: () => void; disabled?: boolean }> = ({ member, isDark, onPress, disabled }) => {
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
    <PressableScale onPress={onPress} activeScale={0.94} disabled={disabled}>
      <View style={styles.userBubble}>
        <SafeAvatar
          avatar={member.avatar}
          size={58}
          fallbackEmoji={member.role === 'parent1' ? '👑' : '👤'}
          fallbackIcon={member.role === 'parent1' ? 'shield' : member.role === 'parent2' ? 'heart' : 'person'}
          fallbackColor={roleColor}
          showStatus={true}
          statusColor={statusColor}
        />
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
   TYPING INDICATOR
   ═══════════════════════════════════════════════════════════════════════════ */
const TypingDots = React.memo<{ color: string }>(({ color }) => {
  const d1 = useSharedValue(0);
  const d2 = useSharedValue(0);
  const d3 = useSharedValue(0);
  useEffect(() => {
    const animate = () => {
      d1.value = withSpring(1, { damping: 10 });
      setTimeout(() => { d2.value = withSpring(1, { damping: 10 }); }, 150);
      setTimeout(() => { d3.value = withSpring(1, { damping: 10 }); }, 300);
      setTimeout(() => { d1.value = withSpring(0); d2.value = withSpring(0); d3.value = withSpring(0); }, 600);
    };
    animate();
    const interval = setInterval(animate, 1200);
    return () => clearInterval(interval);
  }, [d1, d2, d3]);
  const dotStyle = (val: any) => useAnimatedStyle(() => ({
    transform: [{ translateY: val.value * -3 }],
    opacity: 0.4 + val.value * 0.6,
  }));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Animated.View style={[styles.typingDot, { backgroundColor: color }, dotStyle(d1)]} />
      <Animated.View style={[styles.typingDot, { backgroundColor: color }, dotStyle(d2)]} />
      <Animated.View style={[styles.typingDot, { backgroundColor: color }, dotStyle(d3)]} />
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   CHAT LIST ITEM
   ═══════════════════════════════════════════════════════════════════════════ */
const ChatListItem: React.FC<{
  chat: FamilyChat; isDark: boolean; onPress: () => void; onLongPress: () => void;
  unreadCount: number; isTyping?: boolean; onlineStatus?: 'online' | 'away' | 'offline';
  userId?: string;
}> = ({ chat, isDark, onPress, onLongPress, unreadCount, isTyping, onlineStatus, userId }) => {
  const isDirect = chat.type === 'direct';
  const otherParticipantId = isDirect ? chat.participants.find((p) => p !== chat.participantRoles?.[p]) : null;
  const otherAvatar = otherParticipantId ? chat.participantAvatars?.[otherParticipantId] : null;
  const otherRole = otherParticipantId ? chat.participantRoles?.[otherParticipantId] : null;
  const statusColor = onlineStatus === 'online' ? DS.success : onlineStatus === 'away' ? DS.warning : DS.gray400;

  const subtitle = isDirect
    ? (otherRole === 'parent1' ? 'Primary Parent' : otherRole === 'parent2' ? 'Co-Parent' : otherRole === 'guardian' ? 'Guardian' : 'Direct Message')
    : `${chat.participants?.length || 0} family members`;

  const timeStr = (() => {
    if (!chat.lastMessage?.timestamp) return '';
    const d = new Date(chat.lastMessage.timestamp);
    const diff = Date.now() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return 'Yesterday';
    if (days < 7) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  })();

  const preview = (() => {
    if (!chat.lastMessage) return 'No messages yet';
    if (chat.lastMessage.type === 'image') return '📷 Photo';
    if (chat.lastMessage.type === 'voice') return '🎤 Voice';
    if (chat.lastMessage.type === 'file') return '📎 File';
    if (chat.lastMessage.type === 'system') return chat.lastMessage.content;
    return chat.lastMessage.content.length > 34 ? chat.lastMessage.content.slice(0, 34) + '...' : chat.lastMessage.content;
  })();

  return (
    <PressableScale onPress={onPress} onLongPress={onLongPress} activeScale={0.98}>
      <View style={[styles.chatItem, {
        backgroundColor: unreadCount > 0 ? `${DS.primary}08` : isDark ? DS.darkCard : DS.white,
        borderColor: unreadCount > 0 ? `${DS.primary}30` : isDark ? DS.darkBorder : DS.gray200,
        borderLeftWidth: chat.isPinned ? 3 : 1,
        borderLeftColor: chat.isPinned ? DS.primary : undefined,
      }]}>
        {chat.isPinned && (
          <LinearGradient colors={[`${DS.primary}15`, 'transparent']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
        )}

        <View style={{ position: 'relative' }}>
          {isDirect && otherAvatar ? (
            <SafeAvatar avatar={otherAvatar} size={54} fallbackEmoji="👤" fallbackColor={otherRole === 'parent1' ? DS.primary : otherRole === 'parent2' ? DS.accent : DS.success} />
          ) : (
            <LinearGradient
              colors={chat.type === 'group' ? [`${DS.primary}25`, `${DS.accent}15`] : [`${DS.accent}25`, `${DS.primary}15`]}
              style={{ width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 26 }}>{chat.type === 'group' ? '👨‍👩‍👧‍👦' : (chat.avatar || '👤')}</Text>
            </LinearGradient>
          )}
          {onlineStatus && (
            <View style={[styles.onlineDot, { backgroundColor: statusColor, borderColor: isDark ? DS.darkCard : DS.white }]} />
          )}
          {chat.type === 'group' && (
            <View style={[styles.groupBadge, { backgroundColor: DS.primary, borderColor: isDark ? DS.darkCard : DS.white }]}>
              <Ionicons name="people" size={9} color={DS.white} />
            </View>
          )}
        </View>

        <View style={{ flex: 1, marginLeft: DS.space.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.chatName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
              {chat.name}
            </Text>
            {chat.lastMessage && (
              <Text style={[styles.chatTime, { color: unreadCount > 0 ? DS.primary : (isDark ? DS.gray500 : DS.gray400), fontWeight: unreadCount > 0 ? '700' : '500' }]}>
                {timeStr}
              </Text>
            )}
          </View>
          <Text style={[styles.chatSub, { color: isDark ? DS.gray500 : DS.gray400 }]} numberOfLines={1}>{subtitle}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
            {isTyping ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text style={[styles.chatPreview, { color: DS.accent, fontStyle: 'italic' }]}>typing</Text>
                <TypingDots color={DS.accent} />
              </View>
            ) : (
              <>
                {chat.lastMessage?.senderId !== 'system' && chat.lastMessage && (
                  <Text style={[styles.chatPreview, { color: unreadCount > 0 ? DS.primary : (isDark ? DS.gray500 : DS.gray400), fontWeight: '600' }]}>
                    {chat.lastMessage.senderName === 'You' ? 'You: ' : `${chat.lastMessage.senderName.split(' ')[0]}: `}
                  </Text>
                )}
                <Text style={[styles.chatPreview, { color: unreadCount > 0 ? (isDark ? DS.gray200 : DS.gray700) : (isDark ? DS.gray400 : DS.gray500), flex: 1, fontWeight: unreadCount > 0 ? '600' : '500' }]} numberOfLines={1}>
                  {preview}
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={{ alignItems: 'flex-end', marginLeft: DS.space.sm, gap: 4 }}>
          {unreadCount > 0 && (
            <LinearGradient colors={[DS.primary, DS.accent]} style={styles.unreadBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.unreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </LinearGradient>
          )}
          {chat.isMuted && <Ionicons name="volume-mute" size={14} color={isDark ? DS.gray500 : DS.gray400} />}
          {chat.isPinned && <Ionicons name="pin" size={12} color={DS.primary} />}
          <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray400} />
        </View>
      </View>
    </PressableScale>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */
export default function FamilyChatListScreen({ navigation }: FamilyChatListScreenProps) {
  const {
    chats, getUnreadCount, getOrCreateDirectChat, shareFamilyCode, deleteChat,
    pinChat, muteChat, getTypingUsers, createFamilyGroup,
    subscribeToChatMessages,
  } = useFamilyChat();
  const { members } = useFamily();
  const { userProfile } = useAuth();
  const { darkMode } = useCustomization();
  const insets = useSafeAreaInsets();
  const isDark = darkMode ?? false;
  const chatsRef = useRef<FamilyChat[]>(chats);
  useEffect(() => { chatsRef.current = chats; }, [chats]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedChat, setSelectedChat] = useState<FamilyChat | null>(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupPhoto, setGroupPhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [alert, setAlert] = useState<{ visible: boolean; type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string }>({ visible: false, type: 'success', title: '', message: '' });

  // ── Instant list updates on any inbound message ─────────────
  // Subscribing to each chat's message stream is 100x cheaper
  // than polling; the map rebuild is trivial.
  const [realtimeTick, setRealtimeTick] = useState(0);
  const chatIdsKey = useMemo(() => chats.map((c) => c.id).join('|'), [chats]);
  useEffect(() => {
    if (!subscribeToChatMessages) return;
    const unsubs: Array<() => void> = [];
    chatsRef.current.forEach((id) => {
      unsubs.push(
        subscribeToChatMessages(id, () => {
          requestAnimationFrame(() => setRealtimeTick((n) => n + 1));
        }),
      );
    });
    return () => { unsubs.forEach((u) => u()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatIdsKey, subscribeToChatMessages]);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; } });
  const headerAnim = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));

  const otherMembers = useMemo(() => members.filter((m) => m.id !== userProfile?.id && m.userId !== userProfile?.id), [members, userProfile]);

  const onlineCount = useMemo(() => members.filter((m) => {
    if (!m.lastActive) return false;
    return (Date.now() - new Date(m.lastActive).getTime()) / 60000 < 5;
  }).length, [members]);

  const totalUnread = useMemo(
    () => chats.reduce((sum, c) => sum + (c.isMuted ? 0 : c.unreadCount), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chats, realtimeTick],
  );

  const showSweetAlert = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    setAlert({ visible: true, type, title, message });
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    HAPTIC_LIGHT();
    setTimeout(() => {
      setRefreshing(false);
      HAPTIC_SUCCESS();
    }, 1000);
  }, []);

  const ensureDirExists = async () => {
    const dir = FileSystem.documentDirectory + 'group_images/';
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { showSweetAlert('error', 'Permission Required', 'Please allow access to your camera.'); return; }
    try {
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0].uri) {
        setIsUploading(true);
        await ensureDirExists();
        const permanentUri = `${FileSystem.documentDirectory}group_images/group_${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from: result.assets[0].uri, to: permanentUri });
        setGroupPhoto(permanentUri);
        setIsUploading(false);
        HAPTIC_SUCCESS();
      }
    } catch { showSweetAlert('error', 'Error', 'Failed to capture photo'); setIsUploading(false); }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { showSweetAlert('error', 'Permission Required', 'Please allow access to your photo library.'); return; }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0].uri) {
        setIsUploading(true);
        await ensureDirExists();
        const permanentUri = `${FileSystem.documentDirectory}group_images/group_${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from: result.assets[0].uri, to: permanentUri });
        setGroupPhoto(permanentUri);
        setIsUploading(false);
        HAPTIC_SUCCESS();
      }
    } catch { showSweetAlert('error', 'Error', 'Failed to pick photo'); setIsUploading(false); }
  };

  const handleChatPress = async (chat: FamilyChat) => {
    HAPTIC_LIGHT();
    if (chat.type === 'direct') {
      const otherId = chat.participants.find((p) => p !== userProfile?.id);
      const member = otherId ? members.find((m) => m.id === otherId) : undefined;
      navigation.navigate('FamilyChat', {
        chatId: chat.id, memberId: otherId,
        memberName: member?.fullName || chat.name,
        memberAvatar: member?.avatar || chat.avatar,
        memberRole: member?.role, familyCode: chat.familyCode,
      });
    } else {
      navigation.navigate('FamilyChat', { chatId: chat.id, familyCode: chat.familyCode });
    }
  };

  const handleMemberPress = async (member: FamilyMember) => {
    const memberUserId = member.userId || member.id;
    if (memberUserId === userProfile?.id || member.id === userProfile?.id) {
      showSweetAlert('warning', 'Cannot Chat', 'You cannot start a chat with yourself!');
      HAPTIC_WARNING();
      return;
    }
    HAPTIC_LIGHT();
    const chatId = await getOrCreateDirectChat(member.id, member);
    if (chatId) {
      navigation.navigate('FamilyChat', {
        chatId, memberId: member.id, memberName: member.fullName,
        memberAvatar: member.avatar, memberRole: member.role,
      });
    } else {
      showSweetAlert('error', 'Error', 'Failed to create chat. Please try again.');
    }
  };

  const handleLongPress = (chat: FamilyChat) => {
    HAPTIC_HEAVY();
    setSelectedChat(chat);
    setShowOptionsModal(true);
  };

  const handleShareCode = async () => {
    HAPTIC_MEDIUM();
    await shareFamilyCode();
    showSweetAlert('success', 'Shared!', 'Family code has been shared');
  };

  const handleDeleteChat = async () => {
    if (!selectedChat) return;
    HAPTIC_WARNING();
    await deleteChat(selectedChat.id);
    setShowOptionsModal(false);
    setSelectedChat(null);
    showSweetAlert('success', 'Deleted', 'Chat has been removed');
  };

  const handlePinChat = async () => {
    if (!selectedChat) return;
    HAPTIC_LIGHT();
    await pinChat(selectedChat.id, !selectedChat.isPinned);
    setShowOptionsModal(false);
    showSweetAlert('success', selectedChat.isPinned ? 'Unpinned' : 'Pinned', selectedChat.isPinned ? 'Chat unpinned from top' : 'Chat pinned to top');
  };

  const handleMuteChat = async () => {
    if (!selectedChat) return;
    HAPTIC_LIGHT();
    await muteChat(selectedChat.id, !selectedChat.isMuted);
    setShowOptionsModal(false);
    showSweetAlert('info', selectedChat.isMuted ? 'Unmuted' : 'Muted', selectedChat.isMuted ? 'Notifications enabled' : 'Notifications silenced');
  };

  const handleCreateGroup = async () => {
    if (selectedMembers.length < 2) {
      showSweetAlert('warning', 'Select Members', 'Please select at least 2 members to create a group');
      return;
    }
    try {
      const groupNameToUse = groupName.trim() || 'Family Group';
      const chatId = await createFamilyGroup(groupNameToUse, groupPhoto || undefined);
      if (chatId) {
        HAPTIC_SUCCESS();
        showSweetAlert('success', 'Group Created! 🎉', `Created "${groupNameToUse}" with ${selectedMembers.length} members`);
        setShowNewChatModal(false);
        setSelectedMembers([]);
        setGroupName('');
        setGroupPhoto(null);
        navigation.navigate('FamilyChat', { chatId });
      } else {
        showSweetAlert('error', 'Error', 'Failed to create group. Please try again.');
      }
    } catch { showSweetAlert('error', 'Error', 'Failed to create group. Please try again.'); }
  };

  const toggleMemberSelection = (memberId: string) => {
    if (memberId === userProfile?.id) {
      showSweetAlert('warning', 'Cannot Select', 'You cannot add yourself to a group');
      return;
    }
    HAPTIC_LIGHT();
    setSelectedMembers((prev) => prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]);
  };

  const getOnlineStatus = (memberId: string): 'online' | 'away' | 'offline' => {
    const lastActive = members.find((m) => m.id === memberId)?.lastActive;
    if (!lastActive) return 'offline';
    const mins = (Date.now() - new Date(lastActive).getTime()) / 60000;
    if (mins < 5) return 'online';
    if (mins < 30) return 'away';
    return 'offline';
  };

  const isUserTyping = (chatId: string): boolean => {
    const typingUsers = getTypingUsers(chatId);
    return typingUsers.some((u) => u.userId !== userProfile?.id);
  };

  const sortedChats = useMemo(() => {
    const filtered = searchQuery.trim()
      ? chats.filter((c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.lastMessage?.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.participantNames && Object.values(c.participantNames).some((n) => n.toLowerCase().includes(searchQuery.toLowerCase())))
        )
      : chats;
    return [...filtered].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const timeA = a.lastMessage ? new Date(a.lastMessage.timestamp).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.timestamp).getTime() : 0;
      return timeB - timeA;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats, searchQuery, realtimeTick]);

  const renderMembersRow = () => (
    <View style={{ marginTop: DS.space.md }}>
      <SectionHeader
        title="Family Members"
        subtitle={`${members.length} total · ${onlineCount} online`}
        icon="people-outline"
        color={DS.primary}
        action={
          <PressableScale onPress={() => setShowNewChatModal(true)} activeScale={0.94}>
            <LinearGradient colors={[DS.primary, DS.accent]} style={styles.newGroupChip} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Ionicons name="add" size={13} color={DS.white} />
              <Text style={styles.newGroupChipText}>Group</Text>
            </LinearGradient>
          </PressableScale>
        }
      />
      <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 6, paddingVertical: 4 }}>
        {otherMembers.map((member, index) => (
          <Animated.View key={member.id} entering={FadeInRight.delay(index * 40)}>
            <UserBubble member={member} isDark={isDark} onPress={() => handleMemberPress(member)} />
          </Animated.View>
        ))}
        <PressableScale onPress={handleShareCode} activeScale={0.94}>
          <View style={styles.addMember}>
            <View style={[styles.addMemberIcon, { backgroundColor: `${DS.primary}15` }]}>
              <Ionicons name="person-add" size={22} color={DS.primary} />
            </View>
            <Text style={[styles.addMemberText, { color: isDark ? DS.white : DS.gray900 }]}>Invite</Text>
            <Text style={[styles.addMemberSub, { color: isDark ? DS.gray500 : DS.gray400 }]}>New Member</Text>
          </View>
        </PressableScale>
      </Animated.ScrollView>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={isDark ? ['#0c0a09', '#12121e', '#0c0a09'] : ['#f8faff', '#eef0f5', '#e4e8f0']} style={StyleSheet.absoluteFill} />

      <SweetAlert visible={alert.visible} type={alert.type} title={alert.title} message={alert.message} onClose={() => setAlert((p) => ({ ...p, visible: false }))} />

      {/* Sticky header (on scroll) */}
      <Animated.View style={[styles.stickyHeader, {
        paddingTop: HEADER_TOP_PADDING,
        backgroundColor: isDark ? 'rgba(12,10,9,0.92)' : 'rgba(255,255,255,0.92)',
        borderBottomColor: isDark ? DS.darkBorder : DS.gray200,
      }, headerAnim]}>
        <BlurView intensity={isDark ? 90 : 95} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.headerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
            <Ionicons name="arrow-back" size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.headerTitle}>CHAT</GradientText>
            <Text style={[styles.headerSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {chats.length} chat{chats.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={{ width: 38 }} />
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: HEADER_TOP_PADDING + 8, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DS.primary} colors={[DS.primary, DS.accent]} />}
      >
        {/* Pulse header */}
        <PulseHeader
          isDark={isDark}
          chatCount={chats.length}
          unreadCount={totalUnread}
          onlineCount={onlineCount}
          showSearch={showSearch}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onToggleSearch={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(''); }}
          onBack={() => navigation.goBack()}
          onShareCode={handleShareCode}
          onNewGroup={() => setShowNewChatModal(true)}
        />

        {/* Members row */}
        {renderMembersRow()}

        {/* Chats list */}
        <View style={{ marginTop: DS.space.lg }}>
          <SectionHeader title="Conversations" subtitle={`${sortedChats.length} chat${sortedChats.length !== 1 ? 's' : ''}`} icon="chatbubbles-outline" color={DS.accent} />
          <View style={{ paddingHorizontal: DS.space.lg, gap: 8 }}>
            {sortedChats.length === 0 ? (
              <Animated.View entering={FadeIn} style={[styles.emptyCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 }]}>
                  <Text style={{ fontSize: 36 }}>💬</Text>
                </View>
                <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>No chats yet</Text>
                <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                  Tap a family member above to start chatting
                </Text>
                <PressableScale onPress={() => setShowNewChatModal(true)} activeScale={0.97}>
                  <LinearGradient colors={[DS.primary, DS.accent]} style={styles.emptyBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Ionicons name="add-circle" size={16} color={DS.white} />
                    <Text style={styles.emptyBtnText}>Start Group Chat</Text>
                  </LinearGradient>
                </PressableScale>
              </Animated.View>
            ) : (
              sortedChats.map((chat, i) => (
                <Animated.View key={chat.id} entering={FadeInUp.delay(i * 40).springify()}>
                  <ChatListItem
                    chat={chat}
                    isDark={isDark}
                    onPress={() => handleChatPress(chat)}
                    onLongPress={() => handleLongPress(chat)}
                    unreadCount={getUnreadCount(chat.id)}
                    isTyping={isUserTyping(chat.id)}
                    onlineStatus={chat.type === 'direct' ? getOnlineStatus(chat.participants.find((p) => p !== userProfile?.id) || '') : undefined}
                    userId={userProfile?.id}
                  />
                </Animated.View>
              ))
            )}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </Animated.ScrollView>

      {/* Chat Options Modal */}
      <Modal visible={showOptionsModal} transparent animationType="fade" onRequestClose={() => setShowOptionsModal(false)} statusBarTranslucent>
        <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowOptionsModal(false)} activeOpacity={1}>
          <BlurView intensity={isDark ? 70 : 90} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={[styles.optionsModal, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
            <View style={styles.optionsHeader}>
              <Text style={[styles.optionsTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                {selectedChat?.name}
              </Text>
              <TouchableOpacity onPress={() => setShowOptionsModal(false)} style={[styles.optionsClose, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name="close" size={18} color={isDark ? DS.white : DS.gray800} />
              </TouchableOpacity>
            </View>

            <OptionRow icon={selectedChat?.isPinned ? 'pin-off' : 'pin'} label={selectedChat?.isPinned ? 'Unpin Chat' : 'Pin Chat'} color={DS.primary} onPress={handlePinChat} isDark={isDark} />
            <OptionRow icon={selectedChat?.isMuted ? 'volume-high' : 'volume-mute'} label={selectedChat?.isMuted ? 'Unmute' : 'Mute'} color={DS.warning} onPress={handleMuteChat} isDark={isDark} />
            {selectedChat?.type === 'direct' && (
              <OptionRow icon="trash" label="Delete Chat" color={DS.danger} onPress={handleDeleteChat} isDark={isDark} />
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* New Group Modal */}
      <Modal visible={showNewChatModal} transparent animationType="slide" onRequestClose={() => setShowNewChatModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <BlurView intensity={isDark ? 90 : 100} tint={isDark ? 'dark' : 'light'} style={[styles.newGroupModal, { backgroundColor: isDark ? 'rgba(12,10,9,0.98)' : 'rgba(255,255,255,0.98)' }]}>
            <View style={styles.newGroupHeader}>
              <Text style={[styles.newGroupTitle, { color: isDark ? DS.white : DS.gray900 }]}>New Group</Text>
              <TouchableOpacity onPress={() => setShowNewChatModal(false)} style={[styles.optionsClose, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name="close" size={18} color={isDark ? DS.white : DS.gray800} />
              </TouchableOpacity>
            </View>

            {/* Group photo */}
            <View style={{ alignItems: 'center', marginVertical: DS.space.md }}>
              <TouchableOpacity onPress={handlePickImage} style={{ position: 'relative' }}>
                {groupPhoto ? (
                  <Image source={{ uri: groupPhoto }} style={styles.groupPhoto} resizeMode="cover" />
                ) : (
                  <LinearGradient colors={[`${DS.primary}20`, `${DS.accent}20`]} style={[styles.groupPhoto, { alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="camera" size={28} color={DS.primary} />
                  </LinearGradient>
                )}
                {isUploading && (
                  <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 40, alignItems: 'center', justifyContent: 'center' }]}>
                    <ActivityIndicator color={DS.white} />
                  </View>
                )}
                <View style={[styles.groupPhotoBadge, { backgroundColor: DS.primary, borderColor: isDark ? DS.darkCard : DS.white }]}>
                  <Ionicons name="camera" size={12} color={DS.white} />
                </View>
              </TouchableOpacity>
              <Text style={[styles.groupPhotoLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                {groupPhoto ? 'Tap to change' : 'Add group photo'}
              </Text>
            </View>

            <TextInput
              style={[styles.groupInput, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100,
                color: isDark ? DS.white : DS.gray900,
                borderColor: isDark ? DS.darkBorder : DS.gray200,
              }]}
              placeholder="Group Name (optional)"
              placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
              value={groupName}
              onChangeText={setGroupName}
            />

            <Text style={[styles.groupSectionLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              Select Members ({selectedMembers.length} selected)
            </Text>

            <Animated.ScrollView style={{ maxHeight: height * 0.35 }}>
              {otherMembers.map((member) => {
                const selected = selectedMembers.includes(member.id);
                const roleColor = member.role === 'parent1' ? DS.primary : member.role === 'parent2' ? DS.accent : DS.success;
                return (
                  <PressableScale key={member.id} onPress={() => toggleMemberSelection(member.id)} activeScale={0.98}>
                    <View style={[styles.memberRow, {
                      backgroundColor: selected ? `${DS.primary}10` : isDark ? 'rgba(255,255,255,0.03)' : DS.white,
                      borderColor: selected ? DS.primary : isDark ? DS.darkBorder : DS.gray200,
                      borderWidth: selected ? 2 : 1,
                    }]}>
                      <SafeAvatar avatar={member.avatar} size={42} fallbackEmoji="👤" fallbackColor={roleColor} />
                      <View style={{ flex: 1, marginLeft: DS.space.md }}>
                        <Text style={[styles.memberRowName, { color: isDark ? DS.white : DS.gray900 }]}>{member.fullName}</Text>
                        <Text style={[styles.memberRowRole, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                          {member.role === 'parent1' ? 'Primary Parent' : member.role === 'parent2' ? 'Co-Parent' : 'Guardian'}
                        </Text>
                      </View>
                      {selected && <Ionicons name="checkmark-circle" size={22} color={DS.primary} />}
                    </View>
                  </PressableScale>
                );
              })}
            </Animated.ScrollView>

            <PressableScale onPress={handleCreateGroup} disabled={selectedMembers.length < 2} activeScale={0.97}>
              <LinearGradient
                colors={selectedMembers.length >= 2 ? [DS.primary, DS.accent] : [DS.gray300, DS.gray400]}
                style={[styles.createBtn, selectedMembers.length < 2 && { opacity: 0.5 }]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Ionicons name="people" size={16} color={DS.white} />
                <Text style={styles.createBtnText}>Create Group ({selectedMembers.length})</Text>
              </LinearGradient>
            </PressableScale>
          </BlurView>
        </View>
      </Modal>
    </View>
  );
}

const OptionRow: React.FC<{ icon: any; label: string; color: string; onPress: () => void; isDark: boolean }> = ({ icon, label, color, onPress, isDark }) => (
  <PressableScale onPress={onPress} activeScale={0.98}>
    <View style={styles.optionRow}>
      <View style={[styles.optionIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.optionLabel, { color: color === DS.danger ? DS.danger : (isDark ? DS.white : DS.gray900) }]}>{label}</Text>
    </View>
  </PressableScale>
);

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Sticky header */
  stickyHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    paddingBottom: DS.space.md, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: DS.space.lg, height: 48,
  },
  headerIconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  headerSub: { fontSize: 11, fontWeight: '500', marginTop: -2 },

  /* Pulse header */
  pulseWrap: {
    marginHorizontal: DS.space.lg, marginTop: DS.space.md,
    borderRadius: DS.radius['2xl'], padding: DS.space.lg, overflow: 'hidden',
    borderWidth: 1, ...DS.shadow.md, position: 'relative',
  },
  pulseGlowL: { position: 'absolute', top: -80, left: -60, width: 220, height: 220, borderRadius: 110, opacity: 0.9 },
  pulseGlowR: { position: 'absolute', top: -70, right: -70, width: 200, height: 200, borderRadius: 100, opacity: 0.8 },
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md },
  pulseBackBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  pulseIconWrap: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  pulseIconGlow: { position: 'absolute', width: 58, height: 58, borderRadius: 29, backgroundColor: `${DS.primary}35` },
  pulseIconRing: { position: 'absolute', width: 54, height: 54, borderRadius: 27, overflow: 'hidden' },
  pulseIconInner: { width: 46, height: 46, borderRadius: 23, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pulseTitle: { fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  pulseLivePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  pulseLiveText: { fontSize: 10, fontWeight: '800' },
  pulseMiniDot: { width: 6, height: 6, borderRadius: 3 },
  pulseSub: { fontSize: 11, fontWeight: '600', flex: 1 },
  pulseIconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pulseActions: { flexDirection: 'row', gap: DS.space.sm, marginTop: DS.space.md },
  pulseActionPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: DS.radius.md, gap: 6 },
  pulseActionPrimaryText: { color: DS.white, fontSize: 12, fontWeight: '700' },
  pulseActionSecondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: DS.radius.md, borderWidth: 1, gap: 6 },
  pulseActionSecondaryText: { fontSize: 12, fontWeight: '700' },

  /* Search row */
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm },
  searchInner: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 40, borderRadius: 20, paddingHorizontal: 12, borderWidth: 1, gap: 8 },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '500' },

  /* Section */
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: DS.space.lg, marginBottom: DS.space.md, marginTop: DS.space.sm,
  },
  sectionIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1, opacity: 0.8 },

  /* New group chip */
  newGroupChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  newGroupChipText: { color: DS.white, fontSize: 11, fontWeight: '700' },

  /* User bubble */
  userBubble: { alignItems: 'center', paddingHorizontal: 8, gap: 3 },
  userBubbleName: { fontSize: 11, fontWeight: '700', marginTop: 3, maxWidth: 64, textAlign: 'center' },
  userBubbleRole: { fontSize: 9, fontWeight: '600' },

  /* Add member */
  addMember: { alignItems: 'center', paddingHorizontal: 8, gap: 3 },
  addMemberIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  addMemberText: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  addMemberSub: { fontSize: 9, fontWeight: '600' },

  /* Chat item */
  chatItem: {
    flexDirection: 'row', alignItems: 'center', padding: DS.space.md,
    borderRadius: DS.radius.lg, overflow: 'hidden', ...DS.shadow.sm,
  },
  onlineDot: { position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  groupBadge: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  chatName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, flex: 1, marginRight: 6 },
  chatTime: { fontSize: 10, fontWeight: '600' },
  chatSub: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  chatPreview: { fontSize: 11, fontWeight: '500' },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { color: DS.white, fontSize: 10, fontWeight: '800' },
  typingDot: { width: 5, height: 5, borderRadius: 2.5 },

  /* Empty */
  emptyCard: { alignItems: 'center', paddingVertical: DS.space['2xl'], borderRadius: DS.radius.lg, borderWidth: 1, gap: DS.space.sm },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.sm },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptySub: { fontSize: 12, fontWeight: '500', textAlign: 'center', paddingHorizontal: DS.space.lg, marginBottom: DS.space.sm },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: DS.radius.md },
  emptyBtnText: { color: DS.white, fontSize: 12, fontWeight: '700' },

  /* Alert */
  alertOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 9999, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 100 },
  alertContainer: { minWidth: 260, maxWidth: 320, borderRadius: 20, overflow: 'hidden', ...DS.shadow.lg },
  alertGradient: { alignItems: 'center', paddingVertical: DS.space.lg, paddingHorizontal: DS.space.xl, gap: 6 },
  alertTitle: { fontSize: 16, fontWeight: '800', color: DS.white, textAlign: 'center', marginTop: 4 },
  alertMessage: { fontSize: 13, color: 'rgba(255,255,255,0.9)', textAlign: 'center' },
  alertDismiss: { marginTop: 6 },
  alertDismissText: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },

  /* Modals */
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 },
  optionsModal: { width: '100%', maxWidth: 400, borderRadius: DS.radius['2xl'], padding: DS.space.lg, ...DS.shadow.lg },
  optionsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: DS.space.md },
  optionsTitle: { fontSize: 16, fontWeight: '800', flex: 1, marginRight: DS.space.sm },
  optionsClose: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, paddingVertical: 10 },
  optionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { fontSize: 14, fontWeight: '700' },

  /* New group modal */
  newGroupModal: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: DS.space.lg, paddingBottom: 40, maxHeight: height * 0.9 },
  newGroupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: DS.space.md },
  newGroupTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  groupPhoto: { width: 80, height: 80, borderRadius: 40 },
  groupPhotoBadge: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  groupPhotoLabel: { fontSize: 11, fontWeight: '600', marginTop: 6 },
  groupInput: { height: 44, borderRadius: DS.radius.md, paddingHorizontal: 14, fontSize: 14, fontWeight: '500', borderWidth: 1, marginBottom: DS.space.md },
  groupSectionLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: DS.space.sm },
  memberRow: { flexDirection: 'row', alignItems: 'center', padding: DS.space.md, borderRadius: DS.radius.md, marginBottom: 6 },
  memberRowName: { fontSize: 13, fontWeight: '700' },
  memberRowRole: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: DS.radius.md, marginTop: DS.space.md, ...DS.shadow.lg },
  createBtnText: { color: DS.white, fontSize: 14, fontWeight: '800' },
});