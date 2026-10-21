import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Dimensions, Image, Keyboard, LayoutAnimation, Modal, Platform,
  Share, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
  UIManager, useColorScheme, RefreshControl, Pressable,
} from 'react-native';
import Animated, {
  FadeIn, FadeInDown, FadeInUp, FadeInRight,
  interpolate, Extrapolation, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue,
  withRepeat, withSequence, withTiming, withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decode } from 'base64-arraybuffer';

import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity, INITIAL_TOPICS } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useMedia } from '../../context/MediaContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { UniversalSpinner } from '../../components/UniversalSpinner';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '@/utils/supabase';

type Props = NativeStackScreenProps<CommunityStackParamList, 'CommunityProfile'>;

const IS_FABRIC =
  (global as any).nativeFabricUIManager != null ||
  typeof (global as any).RN$Bridgeless !== 'undefined' ||
  typeof (global as any).__turboModuleProxy !== 'undefined';

if (Platform.OS === 'android' && !IS_FABRIC && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/* ─── Aura DS ─── */
const DS = {
  primary: '#6366f1', primaryLight: '#818cf8', primaryDark: '#4f46e5',
  accent: '#ec4899', accentLight: '#f472b6', success: '#10b981',
  warning: '#f59e0b', info: '#0ea5e9', danger: '#ef4444',
  white: '#ffffff', gray50: '#fafaf9', gray100: '#f5f5f4', gray200: '#e7e5e4',
  gray300: '#d6d3d1', gray400: '#a8a29e', gray500: '#78716c',
  gray600: '#57534e', gray700: '#44403c', gray800: '#292524', gray900: '#1c1917',
  darkBg: '#0c0a09', darkSurface: '#1c1917', darkCard: '#292524', darkBorder: 'rgba(255,255,255,0.06)',
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 40, elevation: 12 },
  },
};

const EMOJI_OPTIONS = ['👤', '👩', '👨', '👵', '👴', '👶', '👧', '👦', '🧑', '👮', '👩‍⚕️', '👨‍⚕️', '👩‍🏫', '👨‍🏫', '👩‍🍳', '👨‍🍳', '👩‍⚖️', '👨‍⚖️', '👩‍🌾', '👨‍🌾'];

const ACHIEVEMENTS: Record<string, { emoji: string; name: string; color: string; desc: string }> = {
  first_post: { emoji: '📝', name: 'First Steps', color: '#6366f1', desc: 'Shared your first thread' },
  helpful_parent: { emoji: '💙', name: 'Helpful Parent', color: '#10b981', desc: 'Marked as helpful 10 times' },
  top_contributor: { emoji: '🏆', name: 'Top Contributor', color: '#ec4899', desc: 'Top 1% of contributors' },
  streak_7: { emoji: '🔥', name: '7 Day Streak', color: '#f43f5e', desc: 'Active for 7 days straight' },
  streak_30: { emoji: '🔥', name: '30 Day Streak', color: '#f093fb', desc: 'Active for 30 days straight' },
  rising_star: { emoji: '⭐', name: 'Rising Star', color: '#fbbf24', desc: 'Gained 100 followers' },
  storyteller: { emoji: '📖', name: 'Storyteller', color: '#6a82fb', desc: '50+ posts shared' },
  social_butterfly: { emoji: '🦋', name: 'Social Butterfly', color: '#43e97b', desc: 'Connected with 50+ parents' },
  early_bird: { emoji: '🌅', name: 'Early Bird', color: '#ec4899', desc: 'Joined during beta' },
  verified: { emoji: '✅', name: 'Verified', color: '#6366f1', desc: 'Identity verified' },
};

const TOPIC_COLORS: Record<string, string> = {
  topic_1: '#6366f1', topic_2: '#10b981', topic_3: '#ec4899', topic_4: '#fbbf24',
  topic_5: '#f43f5e', topic_6: '#6a82fb', topic_7: '#f093fb', topic_8: '#4facfe',
  topic_9: '#ec4899', topic_10: '#43e97b', topic_11: '#ec4899', topic_12: '#6366f1',
};

type ProfileTab = 'overview' | 'posts' | 'achievements' | 'settings';

const COMMUNITY_AVATARS_BUCKET = 'community_avatars';
const COMMUNITY_COVERS_BUCKET = 'community_covers';

const isEmojiAvatar = (avatar: string | undefined): boolean => {
  if (!avatar) return false;
  const emojiRegex = /[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FEFF}]|[\u{1F300}-\u{1F5FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{1FB00}-\u{1FBFF}]|[\u{1FC00}-\u{1FCFF}]|[\u{1FD00}-\u{1FDFF}]|[\u{1FE00}-\u{1FEFF}]|[\u{1FF00}-\u{1FFFF}]/u;
  return avatar.length <= 2 && (emojiRegex.test(avatar) || /^[\u{1F000}-\u{1FFFF}]$/u.test(avatar));
};

const generateUniqueFileName = (userId: string, ext: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${userId}_${timestamp}_${random}.${ext}`;
};

const safeArray = <T,>(a: T[] | undefined | null): T[] => (Array.isArray(a) ? a : []);

/* ─── Sub-components ─── */

const GradientText = React.memo(({ children, style, colors = ['#667eea', '#764ba2', '#f093fb'] }: any) => {
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
        return <Text key={i} style={[style, { color: interp(colors[lo] || colors[0], colors[hi] || colors[colors.length - 1], ci - lo) }]}>{l}</Text>;
      })}
    </View>
  );
});

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const PressableScale = React.memo<any>(({ children, onPress, disabled, style, activeScale = 0.96 }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedTouchable
      style={[style, anim]}
      onPress={() => { if (!disabled) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress?.(); } }}
      onPressIn={() => { scale.value = withTiming(activeScale, { duration: 80 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
      activeOpacity={disabled ? 1 : 0.85}
      disabled={disabled}
    >
      {children}
    </AnimatedTouchable>
  );
});

const GlassCard = React.memo(({ children, style, isDark, delay = 0 }: any) => (
  <Animated.View entering={FadeInUp.delay(delay).springify()} style={[styles.glassCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }, style]}>
    <LinearGradient colors={isDark ? ['rgba(255,255,255,0.02)', 'transparent'] : ['rgba(255,255,255,0.4)', 'transparent']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
    {children}
  </Animated.View>
));

const SectionHeader = React.memo(({ title, subtitle, icon, color = DS.primary, action, actionLabel }: any) => (
  <View style={styles.sectionHeader}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm }}>
      {icon && <View style={[styles.sectionIcon, { backgroundColor: `${color}18` }]}><Ionicons name={icon} size={16} color={color} /></View>}
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSub}>{subtitle}</Text>}
      </View>
    </View>
    {action && (
      <TouchableOpacity onPress={action} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Text style={[styles.sectionAction, { color }]}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={13} color={color} />
      </TouchableOpacity>
    )}
  </View>
));

const TabBar = React.memo(({ tabs, activeTab, onChange, isDark }: any) => (
  <View style={[styles.tabBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
    {tabs.map((tab: any) => {
      const active = activeTab === tab.key;
      return (
        <TouchableOpacity key={tab.key} onPress={() => onChange(tab.key)} style={[styles.tabItem, active && { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : DS.white, ...DS.shadow.sm }]} activeOpacity={0.8}>
          <Ionicons name={tab.icon as any} size={14} color={active ? DS.primary : (isDark ? DS.gray400 : DS.gray500)} />
          <Text style={[styles.tabLabel, { color: active ? DS.primary : (isDark ? DS.gray400 : DS.gray500) }, active && { fontWeight: '700' }]}>{tab.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
));

/* Identity Capsule for own profile */
const OwnIdentityCapsule = React.memo<any>(({
  isDark, currentUser, formData, avatarSize, followerCount, followingCount, postCount,
  onAvatarPress, onEdit, isEditing, onSave, isSaving, isVerified, hasChanges, onVerify,
}) => {
  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);
  const glow = useSharedValue(0.4);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.06, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1, true);
    rotate.value = withRepeat(withTiming(360, { duration: 9000 }), -1, false);
    glow.value = withRepeat(withSequence(withTiming(0.85, { duration: 1800 }), withTiming(0.4, { duration: 1800 })), -1, true);
  }, []);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: pulse.value }] }));

  const avatarSource = formData.avatar || currentUser?.avatar;
  const isEmoji = isEmojiAvatar(avatarSource);
  const isUrl = avatarSource && (avatarSource.startsWith('http') || avatarSource.startsWith('file://'));

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()}>
      <View style={[styles.capsule, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient colors={isDark ? ['rgba(99,102,241,0.20)', 'rgba(236,72,153,0.10)', 'rgba(139,92,246,0.05)'] : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.06)', 'rgba(139,92,246,0.03)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        <LinearGradient colors={[`${DS.primary}${isDark ? '45' : '28'}`, 'transparent']} style={styles.capsuleGlowL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none" />
        <LinearGradient colors={[`${DS.accent}${isDark ? '35' : '22'}`, 'transparent']} style={styles.capsuleGlowR} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} pointerEvents="none" />

        <View style={styles.capsuleRow}>
          <PressableScale onPress={isEditing ? onAvatarPress : undefined} disabled={!isEditing} activeScale={0.94}>
            <View style={styles.avatarWrap}>
              <Animated.View style={[styles.avatarGlow, glowStyle]} />
              <Animated.View style={[styles.avatarRing, ringStyle]}>
                <LinearGradient colors={[DS.primary, DS.accent, DS.warning, DS.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
              <View style={[styles.avatarInner, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
                {avatarSource && !isEmoji && isUrl ? (
                  <Image source={{ uri: avatarSource }} style={{ width: avatarSize - 12, height: avatarSize - 12, borderRadius: (avatarSize - 12) / 2 }} resizeMode="cover" />
                ) : (
                  <View style={{ width: avatarSize - 12, height: avatarSize - 12, borderRadius: (avatarSize - 12) / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: `${DS.primary}20` }}>
                    <Text style={{ fontSize: (avatarSize - 12) * 0.42, fontWeight: '800', color: DS.primary }}>
                      {isEmoji ? avatarSource : (currentUser?.displayName?.charAt(0)?.toUpperCase() || '?')}
                    </Text>
                  </View>
                )}
              </View>
              {isEditing && (
                <View style={[styles.editBadge, { borderColor: isDark ? DS.darkSurface : DS.white }]}>
                  <Ionicons name="camera" size={12} color={DS.white} />
                </View>
              )}
            </View>
          </PressableScale>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.capsuleName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                {formData.displayName || currentUser?.displayName || 'You'}
              </Text>
              {isVerified ? (
                <View style={styles.verifiedDot}><Ionicons name="checkmark" size={10} color={DS.white} /></View>
              ) : (
                <PressableScale onPress={onVerify} activeScale={0.9}>
                  <View style={[styles.verifyPill, { backgroundColor: `${DS.primary}15`, borderColor: `${DS.primary}35` }]}>
                    <View style={[styles.verifyTick, { borderColor: DS.primary }]}>
                      <Ionicons name="checkmark" size={8} color={DS.primary} />
                    </View>
                    <Text style={[styles.verifyPillText, { color: DS.primary }]}>Verify</Text>
                  </View>
                </PressableScale>
              )}
            </View>
            <Text style={[styles.capsuleHandle, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
              {formData.handle ? `@${formData.handle.replace(/^@/, '')}` : currentUser?.handle || '@you'}
            </Text>
            <View style={styles.capsuleStats}>
              <View style={styles.capsuleStatItem}>
                <Text style={[styles.capsuleStatValue, { color: DS.primary }]}>{postCount}</Text>
                <Text style={[styles.capsuleStatLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>posts</Text>
              </View>
              <View style={[styles.capsuleStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
              <View style={styles.capsuleStatItem}>
                <Text style={[styles.capsuleStatValue, { color: DS.accent }]}>{followerCount}</Text>
                <Text style={[styles.capsuleStatLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>followers</Text>
              </View>
              <View style={[styles.capsuleStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
              <View style={styles.capsuleStatItem}>
                <Text style={[styles.capsuleStatValue, { color: DS.success }]}>{followingCount}</Text>
                <Text style={[styles.capsuleStatLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>following</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.capsuleActions}>
          {!isEditing ? (
            <>
              <PressableScale onPress={onEdit} activeScale={0.94} style={{ flex: 1 }}>
                <LinearGradient colors={[DS.primary, DS.accent]} style={styles.actionPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Ionicons name="create-outline" size={15} color={DS.white} />
                  <Text style={[styles.actionPrimaryText, { color: DS.white }]}>Edit Profile</Text>
                </LinearGradient>
              </PressableScale>
            </>
          ) : (
            <>
              <PressableScale onPress={onSave} disabled={isSaving || !hasChanges} activeScale={0.94} style={{ flex: 1 }}>
                <LinearGradient colors={hasChanges ? [DS.primary, DS.accent] : [isDark ? DS.darkSurface : DS.gray100, isDark ? DS.darkSurface : DS.gray200]} style={styles.actionPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  {isSaving ? <ActivityIndicator size="small" color={DS.white} /> : (
                    <>
                      <Ionicons name="checkmark" size={15} color={hasChanges ? DS.white : DS.gray400} />
                      <Text style={[styles.actionPrimaryText, { color: hasChanges ? DS.white : DS.gray400 }]}>Save</Text>
                    </>
                  )}
                </LinearGradient>
              </PressableScale>
            </>
          )}
        </View>
      </View>
    </Animated.View>
  );
});

/* Bio/About ribbon */
const ProfileRibbon = React.memo<any>(({ isDark, icon, color, label, text, onPress, trailing }: any) => (
  <Animated.View entering={FadeInUp.delay(80).springify()}>
    <PressableScale onPress={onPress} activeScale={0.98} disabled={!onPress}>
      <View style={[styles.ribbon, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={[styles.ribbonIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={15} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ribbonLabel, { color }]}>{label}</Text>
          <Text style={[styles.ribbonText, { color: isDark ? DS.gray300 : DS.gray700 }]} numberOfLines={2}>{text}</Text>
        </View>
        {trailing || (onPress && <Ionicons name="chevron-forward" size={15} color={isDark ? DS.gray500 : DS.gray400} />)}
      </View>
    </PressableScale>
  </Animated.View>
));

/* Metric bars card */
const MetricsCard = React.memo<any>(({ isDark, title, subtitle, metrics, score, scoreColor = DS.primary }) => (
  <GlassCard isDark={isDark}>
    <View style={{ padding: DS.space.md }}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.cardIcon, { backgroundColor: `${scoreColor}15` }]}>
            <Ionicons name="analytics" size={14} color={scoreColor} />
          </View>
          <View>
            <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900 }]}>{title}</Text>
            {subtitle && <Text style={[styles.cardSub, { color: isDark ? DS.gray500 : DS.gray400 }]}>{subtitle}</Text>}
          </View>
        </View>
        {score !== undefined && (
          <View style={[styles.cardPill, { backgroundColor: `${scoreColor}15` }]}>
            <Text style={[styles.cardPillText, { color: scoreColor }]}>{score}</Text>
          </View>
        )}
      </View>
      <View style={{ gap: 8, marginTop: DS.space.sm }}>
        {metrics.map((m: any) => (
          <View key={m.label} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name={m.icon} size={11} color={m.color} />
              <Text style={[styles.barLabel, { color: m.color, flex: 1 }]}>{m.label}</Text>
              <Text style={[styles.barValue, { color: m.color }]}>{m.value}%</Text>
            </View>
            <View style={[styles.barBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
              <View style={[styles.barFill, { width: `${m.value}%`, backgroundColor: m.color }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  </GlassCard>
));

/* Stat grid card */
const StatGridCard = React.memo<any>(({ isDark, title, stats, icon = 'bar-chart-outline', color = DS.primary }) => (
  <GlassCard isDark={isDark} delay={60}>
    <View style={{ padding: DS.space.md }}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.cardIcon, { backgroundColor: `${color}15` }]}>
            <Ionicons name={icon} size={14} color={color} />
          </View>
          <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900 }]}>{title}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginTop: DS.space.md }}>
        {stats.map((s: any, i: number) => (
          <React.Fragment key={s.label}>
            <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View style={[styles.breakdownIcon, { backgroundColor: `${s.color}15` }]}>
                <Ionicons name={s.icon} size={14} color={s.color} />
              </View>
              <Text style={[styles.breakdownValue, { color: s.color }]}>{s.value}</Text>
              <Text style={[styles.breakdownLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>{s.label}</Text>
            </View>
            {i < stats.length - 1 && <View style={[styles.insightDivider, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  </GlassCard>
));

/* Progress card */
const ProgressCard = React.memo<any>(({ isDark, title, items }) => (
  <GlassCard isDark={isDark} delay={100}>
    <View style={{ padding: DS.space.md, gap: 10 }}>
      <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900 }]}>{title}</Text>
      {items.map((p: any) => (
        <View key={p.label} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[styles.barLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>{p.label}</Text>
            <Text style={[styles.barValue, { color: p.color }]}>{p.value}/{p.max}</Text>
          </View>
          <View style={[styles.barBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
            <View style={[styles.barFill, { width: `${Math.min((p.value / p.max) * 100, 100)}%`, backgroundColor: p.color }]} />
          </View>
        </View>
      ))}
    </View>
  </GlassCard>
));

/* Post row card */
const PostRow = React.memo<any>(({ post, index, onPress, isDark, getTopicColor, getTopicName }) => {
  const topicColor = getTopicColor(post.topicId);
  return (
    <Animated.View entering={FadeInUp.delay(Math.min(index, 6) * 40).springify()}>
      <PressableScale onPress={onPress} activeScale={0.98}>
        <View style={[styles.postCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={[styles.topicPill, { backgroundColor: `${topicColor}15` }]}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: topicColor }} />
              <Text style={[styles.topicPillText, { color: topicColor }]} numberOfLines={1}>{getTopicName(post.topicId)}</Text>
            </View>
            <Text style={[styles.postTime, { color: isDark ? DS.gray500 : DS.gray400 }]}>{post.time}</Text>
          </View>
          <Text style={[styles.postContent, { color: isDark ? DS.gray200 : DS.gray800 }]} numberOfLines={2}>{post.content}</Text>
          <View style={styles.postStats}>
            {[
              { icon: 'heart', value: post.likes, color: post.isLiked ? DS.danger : (isDark ? DS.gray500 : DS.gray400) },
              { icon: 'chatbubble', value: post.commentsCount, color: isDark ? DS.gray500 : DS.gray400 },
              { icon: 'repeat', value: post.reposts || 0, color: isDark ? DS.gray500 : DS.gray400 },
            ].map((s, i) => (
              <View key={i} style={styles.postStat}>
                <Ionicons name={s.icon as any} size={12} color={s.color} />
                <Text style={[styles.postStatText, { color: s.color }]}>{s.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
});

/* Action Modal */
const ActionModal = React.memo(({ visible, onClose, title, children, isDark }: any) => {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent presentationStyle="overFullScreen">
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.springify()} style={[styles.modalCard, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
          <View style={styles.modalDrag}><View style={[styles.dragIndicator, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} /></View>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900 }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={[styles.modalClose, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : DS.gray100 }]}>
              <Ionicons name="close" size={20} color={isDark ? DS.gray300 : DS.gray600} />
            </TouchableOpacity>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
});

/* ═══ MAIN SCREEN ═══ */

export default function CommunityProfileScreen({ navigation }: Props) {
  const {
    currentUser, updateCommunityProfile, syncUserProfileAcrossPosts, getUserPosts, getSelectedTopics,
    getFollowers, getFollowing, checkAndAwardAchievements, getAllUsers, refreshFeed, refreshTopics: refreshTopicsData, getUserProfile,
  } = useCommunity();
  const { profile, updateCommunityProfile: updateUserContextProfile, checkUsernameAvailable, updateUsername } = useUser();
  const { themeColors, fullThemeColors, darkMode, triggerHaptic } = useCustomization();
  const { compressImage } = useMedia();
  const sweetAlert = useSweetAlert();
  const { deleteAccountWithConfirmation, userProfile } = useAuth();

  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = darkMode ?? (colorScheme === 'dark');
  const scrollY = useSharedValue(0);

  const isCompact = SCREEN_W < 360;
  const isTablet = SCREEN_W >= 768;
  const avatarSize = isTablet ? 88 : Math.max(72, Math.min(88, SCREEN_W * 0.22));

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [usernameCheckStatus, setUsernameCheckStatus] = useState<{ available: boolean; message: string } | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isProfileDeactivated, setIsProfileDeactivated] = useState(false);
  const [activityLog, setActivityLog] = useState<any[]>([]);

  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [locationDetected, setLocationDetected] = useState<{ city: string; region: string; country: string; full: string } | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  const [formData, setFormData] = useState({
    displayName: '', handle: '', bio: '', avatar: '', coverPhoto: '', location: '',
    isPublic: true, notificationsEnabled: true, showActivityStatus: true, allowMessages: true,
  });
  const [originalData, setOriginalData] = useState({ ...formData });
  const usernameDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const isLoadingRef = useRef(false);
  const initialLoadDone = useRef(false);
  const isMountedRef = useRef(true);

  const userPostList = useMemo(() => getUserPosts(currentUser?.id || ''), [currentUser, getUserPosts]);
  const allUsers = useMemo(() => getAllUsers(), [getAllUsers]);

  /* Derived metrics */
  const activityScore = useMemo(() => {
    const posts = userPostList;
    const totalPosts = posts.length;
    const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalComments = posts.reduce((sum, p) => sum + (p.commentsCount || 0), 0);
    const totalHelpful = posts.reduce((sum, p) => sum + (p.helpfulVotes || 0), 0);
    const uniqueDays = new Set(posts.map(p => new Date(p.timestamp).toDateString())).size;
    const engagement = Math.min(100, Math.round((totalLikes + totalComments * 2) / Math.max(1, totalPosts) * 5));
    const consistency = Math.min(100, Math.round(uniqueDays / Math.max(1, Math.min(totalPosts, 30)) * 100));
    const helpfulness = Math.min(100, Math.round(totalHelpful / Math.max(1, totalPosts) * 10));
    const creativity = Math.min(100, Math.round((posts.filter(p => p.images?.length > 0).length / Math.max(1, totalPosts)) * 100 + 20));
    const overall = Math.min(100, Math.round((engagement + consistency + helpfulness + creativity) / 4));
    return { overall, engagement, consistency, helpfulness, creativity };
  }, [userPostList]);

  const influenceMetrics = useMemo(() => {
    const totalPosts = userPostList.length;
    const totalLikes = userPostList.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalComments = userPostList.reduce((sum, p) => sum + (p.commentsCount || 0), 0);
    const totalHelpful = userPostList.reduce((sum, p) => sum + (p.helpfulVotes || 0), 0);
    const totalViews = userPostList.reduce((sum, p) => sum + (p.viewCount || 0), 0);
    const avgEngagement = totalPosts > 0 ? Math.min(100, Math.round((totalLikes + totalComments * 2) / totalPosts * 2)) : 0;
    const consistency = Math.min(100, Math.round((totalPosts / Math.max(1, 30)) * 100));
    const helpful = Math.min(100, Math.round(totalHelpful / Math.max(1, totalPosts) * 15));
    const reach = Math.min(100, Math.round(totalViews / Math.max(1, totalPosts * 10) * 100));
    return [
      { label: 'Engagement', value: avgEngagement, color: DS.primary, icon: 'flash' },
      { label: 'Consistency', value: consistency, color: DS.accent, icon: 'calendar' },
      { label: 'Helpful', value: helpful, color: DS.success, icon: 'heart' },
      { label: 'Reach', value: reach, color: DS.warning, icon: 'eye' },
    ];
  }, [userPostList]);

  const weeklyImpact = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekPosts = userPostList.filter(p => new Date(p.timestamp) >= weekAgo);
    const totalHelpful = weekPosts.reduce((sum, p) => sum + (p.helpfulVotes || 0), 0);
    const newConnections = Math.min(20, Math.round(weekPosts.length * 0.3 + Math.random() * 5));
    const rankChange = Math.min(5, Math.max(-5, Math.round((weekPosts.length - 3) * 0.5)));
    return { postsThisWeek: weekPosts.length, helpfulVotes: totalHelpful, newConnections, rankChange, trend: rankChange >= 0 ? 'up' : 'down' };
  }, [userPostList]);

  const communityStanding = useMemo(() => {
    const userPostCount = userPostList.length;
    const allPostCounts = allUsers.map(u => getUserPosts(u.id).length);
    const sortedCounts = [...allPostCounts].sort((a, b) => b - a);
    const rank = sortedCounts.findIndex(c => c <= userPostCount) + 1;
    const percentile = Math.min(100, Math.round((1 - (rank / Math.max(1, allUsers.length))) * 100));
    const totalEngagement = userPostList.reduce((sum, p) => sum + (p.likes || 0) + (p.commentsCount || 0) * 2, 0);
    let rankLabel = 'New Parent';
    let nextMilestone = '50 posts';
    let progressToNext = Math.min(100, Math.round((userPostCount / 50) * 100));
    if (userPostCount > 100 && totalEngagement > 500) { rankLabel = 'Legendary Parent'; nextMilestone = '200 posts'; progressToNext = Math.min(100, Math.round((userPostCount / 200) * 100)); }
    else if (userPostCount > 50 && totalEngagement > 200) { rankLabel = 'Gold Parent'; nextMilestone = '100 posts'; progressToNext = Math.min(100, Math.round((userPostCount / 100) * 100)); }
    else if (userPostCount > 20 && totalEngagement > 50) { rankLabel = 'Silver Parent'; nextMilestone = '50 posts'; progressToNext = Math.min(100, Math.round((userPostCount / 50) * 100)); }
    else if (userPostCount > 5) { rankLabel = 'Bronze Parent'; nextMilestone = '20 posts'; progressToNext = Math.min(100, Math.round((userPostCount / 20) * 100)); }
    return { percentile, rank: rankLabel, nextMilestone, progressToNext };
  }, [userPostList, allUsers, getUserPosts]);

  const contentBreakdown = useMemo(() => ({
    posts: userPostList.length,
    comments: userPostList.reduce((sum, p) => sum + (p.commentsCount || 0), 0),
    reactions: userPostList.reduce((sum, p) => sum + (p.likes || 0), 0),
    shares: userPostList.reduce((sum, p) => sum + (p.reposts || 0), 0),
  }), [userPostList]);

  const activityPattern = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const now = new Date();
    return days.map((day, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (6 - i));
      const dayPosts = userPostList.filter(p => new Date(p.timestamp).toDateString() === date.toDateString());
      const activity = dayPosts.length + dayPosts.reduce((sum, p) => sum + p.likes * 0.3, 0);
      return { day: day.slice(0, 1), activity: Math.round(activity), posts: dayPosts.length };
    });
  }, [userPostList]);

  const contentStreaks = useMemo(() => {
    const postDates = userPostList.map(p => new Date(p.timestamp).toDateString());
    const uniquePostDays = [...new Set(postDates)];
    let currentStreakCount = 0;
    for (let i = uniquePostDays.length - 1; i >= 0; i--) {
      const day = new Date(uniquePostDays[i]);
      const expectedDay = new Date();
      expectedDay.setDate(expectedDay.getDate() - currentStreakCount);
      if (day.toDateString() === expectedDay.toDateString()) currentStreakCount++;
      else break;
    }
    return [
      { type: 'Posting', current: currentStreakCount, best: Math.min(userPostList.length, 30), color: DS.primary, icon: 'document-text' },
      { type: 'Helpful', current: Math.min(5, Math.round(userPostList.reduce((s, p) => s + (p.helpfulVotes || 0), 0) / 2)), best: Math.min(10, Math.round(userPostList.reduce((s, p) => s + (p.helpfulVotes || 0), 0))), color: DS.success, icon: 'heart' },
      { type: 'Active', current: userPostList.length > 0 ? Math.min(30, userPostList.length) : 0, best: Math.min(30, userPostList.length * 2), color: DS.warning, icon: 'flame' },
    ];
  }, [userPostList]);

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP),
  }));

  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; } });

  /* Effects */
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {});
    const hide = Keyboard.addListener('keyboardDidHide', () => {});
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (currentUser && !initialLoadDone.current && !isLoadingRef.current) {
      loadUserData();
      initialLoadDone.current = true;
    }
    return () => { isMountedRef.current = false; };
  }, [currentUser]);

  useFocusEffect(useCallback(() => {
    if (currentUser && !isLoadingRef.current) refreshUserData();
    return () => {};
  }, [currentUser]));

  useEffect(() => { loadActivityLog(); }, []);

  const refreshUserData = useCallback(async () => {
    if (isLoadingRef.current || !currentUser) return;
    isLoadingRef.current = true;
    try {
      const topics = getSelectedTopics();
      const followers = await getFollowers(currentUser.id);
      const following = await getFollowing(currentUser.id);
      if (isMountedRef.current) {
        setSelectedTopics(topics);
        setFollowerCount(followers.length);
        setFollowingCount(following.length);
      }
    } catch (e) { console.error('Error refreshing user data:', e); }
    finally { isLoadingRef.current = false; }
  }, [currentUser, getSelectedTopics, getFollowers, getFollowing]);

  const loadActivityLog = async () => {
    try {
      const log = await AsyncStorage.getItem('@community_activity_log');
      if (log) setActivityLog(JSON.parse(log));
    } catch (e) { console.error('Error loading activity log:', e); }
  };

  const generateIntelligentUsername = useCallback((displayName: string, userId: string): string => {
    let base = displayName.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_');
    if (!base) base = 'parent';
    return `${base}_${userId.slice(0, 6)}`;
  }, []);

  const checkUsername = useCallback(async (username: string) => {
    if (!username || username.length < 3) { setUsernameCheckStatus(null); return; }
    setIsCheckingUsername(true);
    try {
      const result = await checkUsernameAvailable(username, currentUser?.id);
      setUsernameCheckStatus(result);
    } catch (e) { console.error('Username check error:', e); }
    finally { setIsCheckingUsername(false); }
  }, [checkUsernameAvailable, currentUser?.id]);

  useEffect(() => {
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    const handle = formData.handle.replace('@', '').trim();
    if (handle && handle.length >= 3) {
      usernameDebounceRef.current = setTimeout(() => checkUsername(handle), 500);
    } else setUsernameCheckStatus(null);
    return () => { if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current); };
  }, [formData.handle, checkUsername]);

  /* Location */
  useEffect(() => {
    let isMounted = true;
    const detectLocation = async () => {
      try {
        const cachedLocation = await AsyncStorage.getItem('@user_location_cache');
        if (cachedLocation) {
          try {
            const parsed = JSON.parse(cachedLocation);
            if (Date.now() - parsed.timestamp < 7 * 24 * 60 * 60 * 1000 && parsed.data?.full) {
              if (isMounted) { setLocationDetected(parsed.data); setFormData(prev => ({ ...prev, location: (!prev.location || /^unknown/i.test(prev.location)) ? parsed.data.full : prev.location })); }
              return;
            }
          } catch {}
        }
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || !isMounted) return;
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const reverseGeocode = await Location.reverseGeocodeAsync({ latitude: location.coords.latitude, longitude: location.coords.longitude });
        if (reverseGeocode.length > 0 && isMounted) {
          const place = reverseGeocode[0];
          const city = place.city || place.district || place.subregion || '';
          const region = place.region || place.state || '';
          const country = place.country || '';
          const locationParts: string[] = [];
          if (city) locationParts.push(city);
          if (region && region !== city) locationParts.push(region);
          if (country && !locationParts.includes(country)) locationParts.push(country);
          const fullLocation = locationParts.join(', ') || 'Unknown Location';
          const locationData = { city, region, country, full: fullLocation };
          await AsyncStorage.setItem('@user_location_cache', JSON.stringify({ data: locationData, timestamp: Date.now() }));
          if (isMounted) { setLocationDetected(locationData); setFormData(prev => ({ ...prev, location: (!prev.location || /^unknown/i.test(prev.location)) ? fullLocation : prev.location })); }
        }
      } catch (e) { console.log('Location detection error:', e); }
    };
    detectLocation();
    return () => { isMounted = false; };
  }, []);

  const loadUserData = async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsHydrating(true);
    try {
      if (currentUser) {
        let canonicalHandle = '', canonicalAvatar = '', canonicalCover = '', canonicalFullName = '';
        try {
          const { data: profileRow } = await supabase
            .from('profiles')
            .select('community_handle, community_username, community_avatar, avatar_url, community_cover, community_bio, full_name, is_verified')
            .eq('id', currentUser.id).maybeSingle();
          if (profileRow) {
            canonicalHandle = ((profileRow.community_handle || '').toString().replace(/^@+/, '')) || ((profileRow.community_username || '').toString());
            canonicalAvatar = profileRow.community_avatar || profileRow.avatar_url || '';
            canonicalCover = profileRow.community_cover || '';
            canonicalFullName = profileRow.full_name || '';
            if (canonicalHandle && canonicalHandle !== currentUser.handle.replace(/^@+/, '')) {
              await updateCommunityProfile({ handle: `@${canonicalHandle}` });
            }
            if (typeof profileRow.is_verified === 'boolean' && profileRow.is_verified !== currentUser.isVerified) {
              await updateCommunityProfile({ isVerified: profileRow.is_verified });
            }
          }
        } catch (e) { if (__DEV__) console.warn('[Profile] profile sync failed:', e); }

        const topics = getSelectedTopics();
        const followers = await getFollowers(currentUser.id);
        const following = await getFollowing(currentUser.id);
        if (isMountedRef.current) {
          setSelectedTopics(topics);
          setFollowerCount(followers.length);
          setFollowingCount(following.length);
        }

        let currentHandle = currentUser.handle || '';
        if (!currentHandle) currentHandle = generateIntelligentUsername(currentUser.displayName || 'parent', currentUser.id);
        currentHandle = currentHandle.replace(/^@+/, '');

        const resolvedLocation =
          (currentUser.country && !/^unknown/i.test(currentUser.country) && currentUser.country) ||
          (currentUser.location && !/^unknown/i.test(currentUser.location) && currentUser.location) ||
          (locationDetected?.full && locationDetected.full) || '';

        const userCtxFullName = (profile as any)?.fullName || '';
        const authFullName = (userProfile as any)?.fullName || (userProfile as any)?.full_name || '';
        const emailLocalPart = (currentUser.email || '').split('@')[0] || '';
        const derivedFallbackName = (currentHandle && currentHandle.replace(/[_.]/g, ' ').trim()) || emailLocalPart || 'Parent';

        const resolvedDisplayName = (currentUser.displayName && currentUser.displayName.trim()) ||
          (userCtxFullName && String(userCtxFullName).trim()) || (canonicalFullName && canonicalFullName.trim()) ||
          (authFullName && String(authFullName).trim()) || derivedFallbackName;

        const resolvedHandle = currentHandle || generateIntelligentUsername(resolvedDisplayName, currentUser.id);

        const initialData = {
          displayName: resolvedDisplayName, handle: resolvedHandle,
          bio: currentUser.bio || '', avatar: canonicalAvatar || currentUser.avatar || '',
          coverPhoto: canonicalCover || currentUser.coverPhoto || '', location: resolvedLocation,
          isPublic: true, notificationsEnabled: true, showActivityStatus: true, allowMessages: true,
        };
        if (isMountedRef.current) { setFormData(initialData); setOriginalData(initialData); }
      }
    } catch (e) { console.error('Error loading profile:', e); }
    setIsHydrating(false);
    isLoadingRef.current = false;
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refreshFeed(); await refreshTopicsData(); await loadUserData(); await loadActivityLog(); await refreshUserData(); }
    catch (e) { console.error('Refresh error:', e); }
    finally { setRefreshing(false); }
  }, [refreshFeed, refreshTopicsData]);

  /* Image upload */
  const ensureBucket = useCallback(async (bucket: string) => {
    try {
      const { data, error } = await supabase.storage.getBucket(bucket);
      if (error && /not found/i.test(error.message)) await supabase.storage.createBucket(bucket, { public: true });
      return data;
    } catch { return null; }
  }, []);

  const uploadImageToStorage = useCallback(async (localUri: string, userId: string, type: 'avatar' | 'cover'): Promise<string | null> => {
    try {
      if (type === 'avatar') setAvatarUploading(true); else setCoverUploading(true);
      const fileData = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
      const ext = localUri.split('.').pop()?.toLowerCase() || 'jpg';
      const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
      const fileName = generateUniqueFileName(userId, safeExt);
      const bucket = type === 'avatar' ? COMMUNITY_AVATARS_BUCKET : COMMUNITY_COVERS_BUCKET;
      const filePath = type === 'avatar' ? `avatars/${fileName}` : `covers/${fileName}`;
      await ensureBucket(bucket);
      const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, decode(fileData), { contentType: `image/${safeExt}`, cacheControl: '3600', upsert: true });
      if (uploadError) { if (type === 'avatar') setAvatarUploading(false); else setCoverUploading(false); return localUri; }
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;
      const updateData = type === 'avatar' ? { community_avatar: publicUrl, avatar_url: publicUrl } : { community_cover: publicUrl };
      const { error: updateError } = await supabase.from('profiles').update({ ...updateData, updated_at: new Date().toISOString() }).eq('id', userId);
      if (updateError) console.warn(`[upload] Profile update error for ${type}:`, updateError.message);
      if (type === 'avatar' && publicUrl) {
        try { await supabase.from('family_members').update({ avatar: publicUrl }).eq('user_id', userId); } catch {}
      }
      if (type === 'avatar') setAvatarUploading(false); else setCoverUploading(false);
      return publicUrl;
    } catch (e) {
      console.error(`[upload] Error uploading ${type}:`, e);
      if (type === 'avatar') setAvatarUploading(false); else setCoverUploading(false);
      return null;
    }
  }, [ensureBucket]);

  const COMMUNITY_IMAGES_DIR = FileSystem.documentDirectory + 'community_images/';

  const persistCommunityImage = async (sourceUri: string): Promise<string | null> => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(COMMUNITY_IMAGES_DIR);
      if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(COMMUNITY_IMAGES_DIR, { intermediates: true });
      const ext = sourceUri.split('.').pop()?.toLowerCase() || 'jpg';
      const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
      const processedUri = `${COMMUNITY_IMAGES_DIR}${Date.now()}.${safeExt}`;
      if (sourceUri.startsWith('content://')) {
        const base64 = await FileSystem.readAsStringAsync(sourceUri, { encoding: FileSystem.EncodingType.Base64 });
        await FileSystem.writeAsStringAsync(processedUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      } else if (sourceUri.startsWith('data:')) {
        const base64Data = sourceUri.split(',')[1];
        if (base64Data) await FileSystem.writeAsStringAsync(processedUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
        else throw new Error('Invalid data URI');
      } else await FileSystem.copyAsync({ from: sourceUri, to: processedUri });
      const fileInfo = await FileSystem.getInfoAsync(processedUri);
      if (!fileInfo.exists) return null;
      return processedUri;
    } catch (e) { console.error('[persist] Failed:', e); return null; }
  };

  const handleImagePick = async (type: 'avatar' | 'cover') => {
    if (type === 'avatar') setShowImagePicker(false); else setShowCoverPicker(false);
    try {
      triggerHaptic('light');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { sweetAlert.alert('Permission Required', 'Please allow access to your photo library', 'warning'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: type === 'avatar' ? [1, 1] : [16, 9], quality: 0.8 });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setIsSaving(true);
      const rawUri = result.assets[0].uri;
      let processedUri = rawUri;
      try { processedUri = await compressImage(rawUri, 0.8); } catch {}
      const permanentUri = await persistCommunityImage(processedUri);
      if (!permanentUri) { sweetAlert.error('Error', 'Failed to save image'); setIsSaving(false); return; }
      const userId = currentUser?.id;
      if (!userId) { sweetAlert.error('Error', 'User not authenticated'); setIsSaving(false); return; }
      const uploadedUrl = await uploadImageToStorage(permanentUri, userId, type);
      if (uploadedUrl) {
        if (type === 'avatar') {
          setFormData(prev => ({ ...prev, avatar: uploadedUrl }));
          setOriginalData(prev => ({ ...prev, avatar: uploadedUrl }));
          await updateCommunityProfile({ avatar: uploadedUrl });
          await updateUserContextProfile({ avatar: uploadedUrl });
          sweetAlert.success('Photo Updated', 'Profile picture saved');
        } else {
          setFormData(prev => ({ ...prev, coverPhoto: uploadedUrl }));
          setOriginalData(prev => ({ ...prev, coverPhoto: uploadedUrl }));
          await updateCommunityProfile({ coverPhoto: uploadedUrl });
          await updateUserContextProfile({ coverPhoto: uploadedUrl } as any);
          sweetAlert.success('Cover Updated', 'Cover photo saved');
        }
      } else sweetAlert.error('Upload Failed', 'Could not upload image');
      triggerHaptic('success');
      await refreshUserData();
    } catch (e) { console.error(`[handleImagePick] Error:`, e); sweetAlert.error('Error', 'Failed to process image'); }
    finally { setIsSaving(false); }
  };

  const handleTakePhoto = async (type: 'avatar' | 'cover') => {
    if (type === 'avatar') setShowImagePicker(false); else setShowCoverPicker(false);
    try {
      triggerHaptic('light');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { sweetAlert.alert('Permission Required', 'Camera access is needed', 'warning'); return; }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: type === 'avatar' ? [1, 1] : [16, 9], quality: 0.8, cameraType: type === 'avatar' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setIsSaving(true);
      const rawUri = result.assets[0].uri;
      const permanentUri = await persistCommunityImage(rawUri);
      if (!permanentUri) { sweetAlert.error('Error', 'Failed to save photo'); setIsSaving(false); return; }
      const userId = currentUser?.id;
      if (!userId) { sweetAlert.error('Error', 'User not authenticated'); setIsSaving(false); return; }
      const uploadedUrl = await uploadImageToStorage(permanentUri, userId, type);
      if (uploadedUrl) {
        if (type === 'avatar') {
          setFormData(prev => ({ ...prev, avatar: uploadedUrl }));
          setOriginalData(prev => ({ ...prev, avatar: uploadedUrl }));
          await updateCommunityProfile({ avatar: uploadedUrl });
          await updateUserContextProfile({ avatar: uploadedUrl });
          sweetAlert.success('Photo Updated', 'Profile picture saved');
        } else {
          setFormData(prev => ({ ...prev, coverPhoto: uploadedUrl }));
          setOriginalData(prev => ({ ...prev, coverPhoto: uploadedUrl }));
          await updateCommunityProfile({ coverPhoto: uploadedUrl });
          await updateUserContextProfile({ coverPhoto: uploadedUrl } as any);
          sweetAlert.success('Cover Updated', 'Cover photo saved');
        }
      } else sweetAlert.error('Upload Failed', 'Could not upload image');
      triggerHaptic('success');
      await refreshUserData();
    } catch (e) { console.error(`[handleTakePhoto] Error:`, e); sweetAlert.error('Error', 'Failed to take photo'); }
    finally { setIsSaving(false); }
  };

  const handleRemoveImage = async (type: 'avatar' | 'cover') => {
    if (type === 'avatar') setShowImagePicker(false); else setShowCoverPicker(false);
    sweetAlert.confirm(`Remove ${type === 'avatar' ? 'Photo' : 'Cover Photo'}`, `Remove your ${type === 'avatar' ? 'profile picture' : 'cover photo'}?`, async () => {
      const userId = currentUser?.id;
      if (!userId) return;
      if (type === 'avatar') {
        setFormData(prev => ({ ...prev, avatar: '' }));
        setOriginalData(prev => ({ ...prev, avatar: '' }));
        await updateCommunityProfile({ avatar: '' });
        await updateUserContextProfile({ avatar: '' });
        try { await supabase.from('profiles').update({ community_avatar: '', avatar_url: '' }).eq('id', userId); await supabase.from('family_members').update({ avatar: '' }).eq('user_id', userId); } catch {}
        sweetAlert.success('Photo Removed', 'Profile picture removed');
      } else {
        setFormData(prev => ({ ...prev, coverPhoto: '' }));
        setOriginalData(prev => ({ ...prev, coverPhoto: '' }));
        await updateCommunityProfile({ coverPhoto: '' });
        try { await supabase.from('profiles').update({ community_cover: '' }).eq('id', userId); } catch {}
        sweetAlert.success('Cover Photo Removed', 'Cover photo removed');
      }
      await refreshUserData();
    }, () => {}, 'Remove', 'Cancel');
  };

  const handleEmojiSelect = (emoji: string) => {
    setFormData(prev => ({ ...prev, avatar: emoji }));
    setOriginalData(prev => ({ ...prev, avatar: emoji }));
    setShowEmojiPicker(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  /* Actions */
  const handleShareProfile = async () => {
    if (!currentUser) return;
    try { triggerHaptic('medium'); await Share.share({ message: `Check out ${currentUser.displayName} on LittleLoom! ${currentUser.handle}`, title: `${currentUser.displayName}'s Profile` }); } catch (e) { console.error('Error sharing profile:', e); }
  };

  const handleClearActivity = async () => {
    sweetAlert.confirm('Clear Activity History', 'This will clear your activity log and post history.', async () => {
      try {
        await AsyncStorage.removeItem('@community_activity_log');
        setActivityLog([]);
        if (currentUser) {
          const resetStats = { ...currentUser.stats, posts: userPostList.length, helpful: 0, streakDays: 0 };
          await updateCommunityProfile({ stats: resetStats });
        }
        sweetAlert.success('Cleared', 'Your activity history has been cleared');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch { sweetAlert.error('Error', 'Failed to clear activity'); }
    }, () => {}, 'Clear', 'Cancel');
  };

  const handleDeactivateProfile = async () => {
    sweetAlert.confirm('Deactivate Profile', 'Your profile will be hidden from others.', async () => {
      try { setIsProfileDeactivated(true); await updateCommunityProfile({ isPublic: false, onlineStatus: 'offline' }); sweetAlert.success('Deactivated', 'Your profile is now hidden'); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
      catch { sweetAlert.error('Error', 'Failed to deactivate profile'); }
    }, () => {}, 'Deactivate', 'Cancel');
  };

  const handleReactivateProfile = async () => {
    try { setIsProfileDeactivated(false); await updateCommunityProfile({ isPublic: true, onlineStatus: 'online' }); sweetAlert.success('Reactivated', 'Your profile is now visible'); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
    catch { sweetAlert.error('Error', 'Failed to reactivate profile'); }
  };

  const handleDeleteCommunityAccount = useCallback(() => {
    sweetAlert.confirm('Delete Community Profile', '⚠️ This will permanently delete your community profile and all activity.', async () => {
      const result = await deleteAccountWithConfirmation();
      if (result.success) { sweetAlert.success('Account Deleted', result.message); navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] }); }
      else sweetAlert.error('Error', result.message);
    }, () => {}, 'Delete', 'Cancel');
  }, [deleteAccountWithConfirmation, navigation, sweetAlert]);

  const handleGoVerify = useCallback(() => { triggerHaptic('light'); navigation.navigate('CommunityVerification'); }, [navigation, triggerHaptic]);

  const handleSave = async () => {
    if (!currentUser) return;
    let effectiveDisplayName = (formData.displayName || '').trim();
    if (!effectiveDisplayName) {
      const fallback = (currentUser.displayName || '').trim() || ((profile as any)?.fullName || '').toString().trim() || ((userProfile as any)?.fullName || '').toString().trim() || (currentUser.handle || '').replace(/^@+/, '').replace(/[_.]/g, ' ').trim() || (currentUser.email || '').split('@')[0] || 'Parent';
      effectiveDisplayName = fallback;
      setFormData(prev => ({ ...prev, displayName: effectiveDisplayName }));
    }
    if (!effectiveDisplayName) { sweetAlert.error('Validation Error', 'Display name is required'); triggerHaptic('error'); return; }

    const cleanHandle = formData.handle.replace(/^@+/, '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_.]/g, '');
    if (!cleanHandle || cleanHandle.length < 3) { sweetAlert.error('Validation Error', 'Username must be at least 3 characters'); triggerHaptic('error'); return; }
    if (cleanHandle.length > 30) { sweetAlert.error('Validation Error', 'Username must be less than 30 characters'); triggerHaptic('error'); return; }
    if (!/^[a-zA-Z][a-zA-Z0-9_.]*$/.test(cleanHandle)) { sweetAlert.error('Invalid Username', 'Must start with a letter. Only letters, numbers, underscores, and dots allowed.'); triggerHaptic('error'); return; }

    const originalHandle = originalData.handle.replace(/^@+/, '');
    if (cleanHandle !== originalHandle) {
      const check = await checkUsernameAvailable(cleanHandle, currentUser.id);
      if (!check.available) { sweetAlert.error('Username Unavailable', check.message); triggerHaptic('error'); return; }
    }

    setIsSaving(true);
    triggerHaptic('medium');
    try {
      const handle = formData.handle.startsWith('@') ? formData.handle : `@${formData.handle}`;
      const updates: any = {
        displayName: effectiveDisplayName, handle: handle.toLowerCase(),
        bio: formData.bio.trim(), avatar: formData.avatar, coverPhoto: formData.coverPhoto,
        country: formData.location, isPublic: formData.isPublic,
        notificationsEnabled: formData.notificationsEnabled, showActivityStatus: formData.showActivityStatus, allowMessages: formData.allowMessages,
      };
      const originalClean = originalHandle.replace(/^@+/, '').toLowerCase();
      if (cleanHandle !== originalClean) {
        const result = await updateUsername(originalClean, cleanHandle, currentUser.id);
        if (!result.success) throw new Error(result.message);
      }
      await updateUserContextProfile(updates);
      await updateCommunityProfile(updates);
      await syncUserProfileAcrossPosts(currentUser.id, { displayName: updates.displayName, handle: updates.handle, avatar: updates.avatar });
      if (formData.avatar && formData.avatar !== originalData.avatar && !formData.avatar.startsWith('file://')) {
        try { await supabase.from('profiles').update({ community_avatar: formData.avatar, avatar_url: formData.avatar }).eq('id', currentUser.id); await supabase.from('family_members').update({ avatar: formData.avatar }).eq('user_id', currentUser.id); } catch {}
      }
      const newAchievements = await checkAndAwardAchievements();
      if (newAchievements.length > 0) sweetAlert.success('Achievement Unlocked!', `You earned ${newAchievements.length} new badge${newAchievements.length > 1 ? 's' : ''}!`);
      triggerHaptic('success');
      setIsEditing(false);
      setOriginalData({ ...formData });
      sweetAlert.success('Profile Updated', 'Your community profile has been saved');
    } catch (error: any) {
      triggerHaptic('error');
      sweetAlert.error('Save Failed', error.message || 'Please try again');
    }
    setIsSaving(false);
  };

  const hasChanges = useMemo(() => Object.keys(formData).some(key => formData[key as keyof typeof formData] !== originalData[key as keyof typeof originalData]), [formData, originalData]);

  const handleTabChange = useCallback((tab: ProfileTab) => {
    if (!IS_FABRIC) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const getTopicColor = useCallback((id: string) => TOPIC_COLORS[id] || DS.primary, []);
  const getTopicName = useCallback((id: string) => INITIAL_TOPICS.find(t => t.id === id)?.name || 'General', []);

  /* ── Guards ── */
  if (!currentUser) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50, alignItems: 'center', justifyContent: 'center' }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <Ionicons name="person-outline" size={64} color={DS.gray400} />
        <Text style={{ marginTop: 16, color: isDark ? DS.gray400 : DS.gray500, fontSize: 16, fontWeight: '600' }}>Not signed in</Text>
        <PressableScale onPress={() => navigation.goBack()} activeScale={0.96}>
          <LinearGradient colors={[DS.primary, DS.accent]} style={{ marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: DS.white }}>Go Back</Text>
          </LinearGradient>
        </PressableScale>
      </View>
    );
  }

  const tabs = [
    { key: 'overview' as ProfileTab, label: 'Overview', icon: 'grid-outline' as const },
    { key: 'posts' as ProfileTab, label: 'Posts', icon: 'document-text-outline' as const },
    { key: 'achievements' as ProfileTab, label: 'Badges', icon: 'trophy-outline' as const },
    { key: 'settings' as ProfileTab, label: 'Settings', icon: 'settings-outline' as const },
  ];

  const topRibbon = useMemo(() => {
    if (userPostList.length === 0) return { icon: 'sparkles-outline' as const, color: DS.primary, label: 'Get started', text: 'Share your first post and connect with other parents' };
    if (activityScore.overall >= 80) return { icon: 'trophy-outline' as const, color: DS.success, label: 'Thriving', text: `You're in the top ${100 - communityStanding.percentile}% of active parents` };
    if (activityScore.overall >= 50) return { icon: 'trending-up-outline' as const, color: DS.primary, label: 'Growing', text: `${weeklyImpact.postsThisWeek} posts this week — keep the momentum` };
    return { icon: 'leaf-outline' as const, color: DS.warning, label: 'Building', text: 'Post regularly to unlock more community features' };
  }, [activityScore, communityStanding, weeklyImpact, userPostList.length]);

  /* ═══ RENDER ═══ */
  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <LinearGradient colors={isDark ? [DS.darkBg, '#12121e', DS.darkBg] : ['#f8faff', '#eef0f5', '#e4e8f0']} style={StyleSheet.absoluteFill} />

      {/* Sticky header */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]} pointerEvents="none">
        <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Text style={[styles.stickyTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{formData.displayName || currentUser?.displayName || 'You'}</Text>
        <Text style={[styles.stickySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>{formData.handle ? `@${formData.handle.replace(/^@/, '')}` : currentUser?.handle || ''}</Text>
      </Animated.View>

      {/* Back */}
      <Animated.View entering={FadeInDown.springify()} style={[styles.topHeader, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
        <PressableScale onPress={() => navigation.goBack()} activeScale={0.92}>
          <View style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(15,15,30,0.55)' : 'rgba(255,255,255,0.85)', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)' }]}>
            <Ionicons name="arrow-back" size={22} color={isDark ? DS.white : DS.gray800} />
          </View>
        </PressableScale>
        <View style={{ flex: 1 }} />
        {!isEditing && currentUser && (
          <PressableScale onPress={() => { triggerHaptic('light'); navigation.push('CommunityMemberProfile', { userId: currentUser.id }); }} activeScale={0.92}>
            <View style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(15,15,30,0.55)' : 'rgba(255,255,255,0.85)', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)' }]}>
              <Ionicons name="eye-outline" size={20} color={isDark ? DS.white : DS.gray800} />
            </View>
          </PressableScale>
        )}
        {isEditing && (
          <PressableScale onPress={() => { setIsEditing(false); setFormData({ ...originalData }); }} activeScale={0.92}>
            <View style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(15,15,30,0.55)' : 'rgba(255,255,255,0.85)', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)' }]}>
              <Ionicons name="close" size={22} color={isDark ? DS.white : DS.gray800} />
            </View>
          </PressableScale>
        )}
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 68, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DS.primary} colors={[DS.primary, DS.accent]} />}
      >
        {/* Identity Capsule */}
        <View style={{ paddingHorizontal: DS.space.lg }}>
          {isHydrating && !formData.displayName ? (
            <View style={[styles.capsule, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <View style={styles.capsuleRow}>
                <View style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }} />
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={{ height: 18, width: 140, borderRadius: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }} />
                  <View style={{ height: 12, width: 100, borderRadius: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }} />
                </View>
              </View>
            </View>
          ) : (
            <OwnIdentityCapsule
              isDark={isDark}
              currentUser={currentUser}
              formData={formData}
              avatarSize={avatarSize}
              followerCount={followerCount}
              followingCount={followingCount}
              postCount={userPostList.length}
              onAvatarPress={() => setShowImagePicker(true)}
              onEdit={() => { setIsEditing(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              isEditing={isEditing}
              onSave={handleSave}
              isSaving={isSaving}
              isVerified={!!currentUser?.isVerified}
              hasChanges={hasChanges}
              onVerify={handleGoVerify}
            />
          )}
        </View>

        {/* Bio ribbon */}
        {(formData.bio || currentUser?.bio || formData.location) && (
          <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
            <ProfileRibbon
              isDark={isDark}
              icon="sparkles-outline"
              color={DS.primary}
              label="About"
              text={isEditing ? (formData.bio || 'Add a bio in Settings') : (currentUser?.bio || formData.bio || 'No bio yet')}
              onPress={() => handleTabChange('settings')}
            />
          </View>
        )}

        {/* Contextual ribbon */}
        {!isEditing && (
          <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
            <ProfileRibbon isDark={isDark} icon={topRibbon.icon} color={topRibbon.color} label={topRibbon.label} text={topRibbon.text} />
          </View>
        )}

        {/* Tab bar */}
        <View style={{ marginTop: DS.space.md }}>
          <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} isDark={isDark} />
        </View>

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && !isEditing && (
          <View style={{ marginTop: DS.space.md, gap: 10, paddingHorizontal: DS.space.lg }}>
            <MetricsCard
              isDark={isDark}
              title="Influence Score"
              subtitle={`${userPostList.length} posts analyzed`}
              metrics={influenceMetrics}
              score={Math.round(influenceMetrics.reduce((a, b) => a + b.value, 0) / influenceMetrics.length)}
              scoreColor={DS.primary}
            />

            <StatGridCard
              isDark={isDark}
              title="This Week"
              icon="flash-outline"
              color={DS.accent}
              stats={[
                { label: 'Posts', value: weeklyImpact.postsThisWeek, color: DS.primary, icon: 'document-text' },
                { label: 'Helpful', value: weeklyImpact.helpfulVotes, color: DS.success, icon: 'heart' },
                { label: 'New', value: weeklyImpact.newConnections, color: DS.accent, icon: 'people' },
              ]}
            />

            <GlassCard isDark={isDark} delay={60}>
              <View style={{ padding: DS.space.md }}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={[styles.cardIcon, { backgroundColor: '#8b5cf615' }]}>
                      <Ionicons name="trophy" size={14} color="#8b5cf6" />
                    </View>
                    <View>
                      <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900 }]}>Community Standing</Text>
                      <Text style={[styles.cardSub, { color: isDark ? DS.gray500 : DS.gray400 }]}>Top {communityStanding.percentile}% of {allUsers.length}</Text>
                    </View>
                  </View>
                  <View style={[styles.cardPill, { backgroundColor: '#8b5cf615' }]}>
                    <Text style={[styles.cardPillText, { color: '#8b5cf6' }]}>{communityStanding.rank}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: DS.space.md }}>
                  <View style={[styles.rankBadge, { backgroundColor: '#8b5cf615' }]}>
                    <Text style={[styles.rankBadgeText, { color: '#8b5cf6' }]}>{communityStanding.progressToNext}%</Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[styles.barLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Next: {communityStanding.nextMilestone}</Text>
                    <View style={[styles.barBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                      <View style={[styles.barFill, { width: `${communityStanding.progressToNext}%`, backgroundColor: '#8b5cf6' }]} />
                    </View>
                  </View>
                </View>
              </View>
            </GlassCard>

            <StatGridCard
              isDark={isDark}
              title="Content Breakdown"
              icon="pie-chart-outline"
              color={DS.info}
              stats={[
                { label: 'Posts', value: contentBreakdown.posts, color: DS.primary, icon: 'document-text' },
                { label: 'Comments', value: contentBreakdown.comments, color: DS.info, icon: 'chatbubble' },
                { label: 'Reactions', value: contentBreakdown.reactions, color: DS.accent, icon: 'heart' },
                { label: 'Shares', value: contentBreakdown.shares, color: DS.success, icon: 'share' },
              ]}
            />

            <GlassCard isDark={isDark} delay={120}>
              <View style={{ padding: DS.space.md }}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900 }]}>Weekly Activity</Text>
                  <View style={[styles.livePill, { backgroundColor: `${DS.success}15` }]}>
                    <View style={[styles.liveDot, { backgroundColor: DS.success }]} />
                    <Text style={[styles.liveText, { color: DS.success }]}>Live</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 70, marginTop: DS.space.md }}>
                  {activityPattern.map((p, i) => {
                    const maxVal = Math.max(...activityPattern.map((d) => d.activity), 1);
                    const height = Math.max(4, (p.activity / maxVal) * 56);
                    return (
                      <View key={i} style={{ alignItems: 'center', gap: 4, flex: 1 }}>
                        <View style={[styles.activityBar, { height, backgroundColor: p.activity > maxVal * 0.7 ? DS.primary : p.activity > maxVal * 0.3 ? `${DS.primary}80` : `${DS.primary}40` }]} />
                        <Text style={[styles.activityLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>{p.day}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </GlassCard>

            <SectionHeader title="Recent Posts" subtitle={`${userPostList.length} total`} icon="document-text-outline" color={DS.primary} action={() => handleTabChange('posts')} actionLabel="See All" />
            {userPostList.slice(0, 3).map((post, i) => (
              <PostRow key={post.id} post={post} index={i} onPress={() => navigation.navigate('PostDetail' as never, { postId: post.id } as never)} isDark={isDark} getTopicColor={getTopicColor} getTopicName={getTopicName} />
            ))}
          </View>
        )}

        {/* ── POSTS ── */}
        {activeTab === 'posts' && !isEditing && (
          <View style={{ marginTop: DS.space.md, gap: 10, paddingHorizontal: DS.space.lg }}>
            {userPostList.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <Ionicons name="document-text-outline" size={40} color={DS.primary} />
                <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>No posts yet</Text>
                <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Share your first story with the community!</Text>
                <PressableScale onPress={() => navigation.navigate('CreatePost' as never, {} as never)} activeScale={0.96} style={{ marginTop: DS.space.md }}>
                  <LinearGradient colors={[DS.primary, DS.accent]} style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 }}>
                    <Text style={{ color: DS.white, fontSize: 14, fontWeight: '700' }}>Create Post</Text>
                  </LinearGradient>
                </PressableScale>
              </View>
            ) : (
              userPostList.map((post, i) => (
                <PostRow key={post.id} post={post} index={i} onPress={() => navigation.navigate('PostDetail' as never, { postId: post.id } as never)} isDark={isDark} getTopicColor={getTopicColor} getTopicName={getTopicName} />
              ))
            )}
          </View>
        )}

        {/* ── ACHIEVEMENTS ── */}
        {activeTab === 'achievements' && !isEditing && (
          <View style={{ marginTop: DS.space.md, gap: 10, paddingHorizontal: DS.space.lg }}>
            <SectionHeader title="Achievements" subtitle={`${(currentUser?.achievements || []).length} earned`} icon="trophy-outline" color={DS.primary} />
            <GlassCard isDark={isDark}>
              <View style={{ padding: DS.space.md, gap: 8 }}>
                {(currentUser?.achievements || []).length > 0 ? (
                  (currentUser?.achievements || []).map((achievement) => {
                    const badge = ACHIEVEMENTS[achievement] || { emoji: '🏅', name: achievement, color: DS.primary, desc: '' };
                    return (
                      <View key={achievement} style={[styles.achievementRow, { backgroundColor: `${badge.color}08` }]}>
                        <View style={[styles.achievementIcon, { backgroundColor: `${badge.color}15` }]}>
                          <Text style={{ fontSize: 20 }}>{badge.emoji}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.achievementName, { color: badge.color }]}>{badge.name}</Text>
                          <Text style={[styles.achievementDesc, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>{badge.desc}</Text>
                        </View>
                        <Ionicons name="checkmark-circle" size={16} color={badge.color} style={{ opacity: 0.6 }} />
                      </View>
                    );
                  })
                ) : (
                  <View style={{ alignItems: 'center', paddingVertical: DS.space['2xl'], gap: 8 }}>
                    <Ionicons name="trophy-outline" size={40} color={DS.primary} />
                    <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>No achievements yet</Text>
                    <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Start posting and engaging to earn badges!</Text>
                  </View>
                )}
              </View>
            </GlassCard>

            <ProgressCard
              isDark={isDark}
              title="Progress"
              items={[
                { label: 'Posts', value: userPostList.length, max: 50, color: DS.primary },
                { label: 'Helpful votes', value: currentUser?.stats?.helpful || 0, max: 50, color: DS.success },
              ]}
            />

            <SectionHeader title="Streaks" subtitle="Consistency tracking" icon="flame-outline" color={DS.warning} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {contentStreaks.map((streak) => (
                <View key={streak.type} style={[styles.streakCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: `${streak.color}30` }]}>
                  <View style={[styles.streakIcon, { backgroundColor: `${streak.color}15` }]}>
                    <Ionicons name={streak.icon as any} size={16} color={streak.color} />
                  </View>
                  <Text style={[styles.streakValue, { color: streak.color }]}>{streak.current}</Text>
                  <Text style={[styles.streakLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>{streak.type}</Text>
                  <Text style={[styles.streakBest, { color: isDark ? DS.gray500 : DS.gray400 }]}>Best: {streak.best}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── SETTINGS (View mode) ── */}
        {activeTab === 'settings' && !isEditing && (
          <View style={{ marginTop: DS.space.md, gap: 10, paddingHorizontal: DS.space.lg }}>
            <GlassCard isDark={isDark}>
              <View style={{ padding: DS.space.md }}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900 }]}>About Me</Text>
                  <PressableScale onPress={() => setIsEditing(true)} activeScale={0.94}>
                    <View style={[styles.editIconBtn, { backgroundColor: `${DS.primary}15` }]}>
                      <Ionicons name="create-outline" size={16} color={DS.primary} />
                    </View>
                  </PressableScale>
                </View>
                <Text style={[styles.bioText, { color: isDark ? DS.gray300 : DS.gray700, marginTop: DS.space.sm }]}>
                  {formData.bio || currentUser?.bio || 'No bio yet. Tap edit to add one!'}
                </Text>
                {formData.location && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: DS.space.md }}>
                    <Ionicons name="location-outline" size={14} color={DS.primary} />
                    <Text style={[styles.bioLocation, { color: isDark ? DS.gray400 : DS.gray500 }]}>{formData.location}</Text>
                  </View>
                )}
              </View>
            </GlassCard>

            <GlassCard isDark={isDark} delay={60}>
              <View style={{ padding: DS.space.md }}>
                <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900, marginBottom: DS.space.md }]}>Interested Topics</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {selectedTopics.length > 0 ? selectedTopics.map((topicId) => {
                    const topic = INITIAL_TOPICS.find(t => t.id === topicId);
                    const topicColor = topic?.color || TOPIC_COLORS[topicId] || DS.primary;
                    const topicName = topic?.name || topicId;
                    return (
                      <View key={topicId} style={[styles.topicChip, { backgroundColor: `${topicColor}20` }]}>
                        <Text style={[styles.topicChipText, { color: topicColor }]}>{topic?.emoji ? `${topic.emoji} ${topicName}` : topicName}</Text>
                      </View>
                    );
                  }) : (
                    <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>No topics selected yet. Tap "Manage Your Topics" below.</Text>
                  )}
                </View>
              </View>
            </GlassCard>

            <PressableScale onPress={() => navigation.navigate('CommunityOnboarding' as never, { editing: true } as never)} activeScale={0.98}>
              <View style={[styles.settingsRow, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <View style={[styles.cardIcon, { backgroundColor: `${DS.primary}15` }]}>
                  <Ionicons name="pricetags-outline" size={16} color={DS.primary} />
                </View>
                <Text style={[styles.settingsRowLabel, { color: isDark ? DS.white : DS.gray900 }]}>
                  Manage Your Topics {selectedTopics.length > 0 ? `(${selectedTopics.length})` : ''}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray400} />
              </View>
            </PressableScale>

            {/* Danger zone */}
            <SectionHeader title="Account Actions" subtitle="Manage your profile" icon="shield-outline" color={DS.danger} />
            <GlassCard isDark={isDark}>
              <View style={{ padding: DS.space.md, gap: 8 }}>
                <TouchableOpacity onPress={handleClearActivity} style={[styles.settingsRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.gray50 }]}>
                  <View style={[styles.cardIcon, { backgroundColor: `${DS.danger}15` }]}>
                    <Ionicons name="trash-outline" size={16} color={DS.danger} />
                  </View>
                  <Text style={[styles.settingsRowLabel, { color: isDark ? DS.white : DS.gray900 }]}>Clear Activity History</Text>
                  <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray400} />
                </TouchableOpacity>

                {isProfileDeactivated ? (
                  <TouchableOpacity onPress={handleReactivateProfile} style={[styles.settingsRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.gray50 }]}>
                    <View style={[styles.cardIcon, { backgroundColor: `${DS.success}15` }]}>
                      <Ionicons name="refresh-outline" size={16} color={DS.success} />
                    </View>
                    <Text style={[styles.settingsRowLabel, { color: DS.success }]}>Reactivate Profile</Text>
                    <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray400} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={handleDeactivateProfile} style={[styles.settingsRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.gray50 }]}>
                    <View style={[styles.cardIcon, { backgroundColor: `${DS.warning}15` }]}>
                      <Ionicons name="pause-circle-outline" size={16} color={DS.warning} />
                    </View>
                    <Text style={[styles.settingsRowLabel, { color: DS.warning }]}>Deactivate Profile</Text>
                    <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray400} />
                  </TouchableOpacity>
                )}

                <TouchableOpacity onPress={handleDeleteCommunityAccount} style={[styles.settingsRow, { backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.04)' }]}>
                  <View style={[styles.cardIcon, { backgroundColor: `${DS.danger}15` }]}>
                    <Ionicons name="person-remove-outline" size={16} color={DS.danger} />
                  </View>
                  <Text style={[styles.settingsRowLabel, { color: DS.danger, fontWeight: '700' }]}>Delete Entire Account</Text>
                  <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray400} />
                </TouchableOpacity>
              </View>
            </GlassCard>
          </View>
        )}

        {/* ── EDIT MODE ── */}
        {isEditing && (
          <View style={{ marginTop: DS.space.md, gap: 10, paddingHorizontal: DS.space.lg }}>
            <GlassCard isDark={isDark}>
              <View style={{ padding: DS.space.md }}>
                <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900, marginBottom: DS.space.md }]}>Edit Profile</Text>

                <Text style={[styles.inputLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Display Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100, color: isDark ? DS.white : DS.gray900 }]}
                  value={formData.displayName}
                  onChangeText={(t) => setFormData(prev => ({ ...prev, displayName: t }))}
                  placeholder="Your display name"
                  placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
                  selectionColor={DS.primary}
                />

                <Text style={[styles.inputLabel, { color: isDark ? DS.gray400 : DS.gray500, marginTop: DS.space.md }]}>Username</Text>
                <View style={[styles.inputRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: DS.primary }}>@</Text>
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: 'transparent', color: isDark ? DS.white : DS.gray900 }]}
                    value={formData.handle}
                    onChangeText={(text) => {
                      const cleaned = text.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_.]/g, '');
                      setFormData(prev => ({ ...prev, handle: cleaned }));
                    }}
                    placeholder="username"
                    placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
                    autoCapitalize="none"
                    selectionColor={DS.primary}
                  />
                  {isCheckingUsername && <ActivityIndicator size="small" color={DS.primary} />}
                </View>
                {usernameCheckStatus && (
                  <View style={[styles.usernameStatus, { backgroundColor: usernameCheckStatus.available ? `${DS.success}10` : `${DS.danger}10`, borderColor: usernameCheckStatus.available ? DS.success : DS.danger }]}>
                    <Ionicons name={usernameCheckStatus.available ? 'checkmark-circle' : 'alert-circle'} size={13} color={usernameCheckStatus.available ? DS.success : DS.danger} />
                    <Text style={[styles.usernameStatusText, { color: usernameCheckStatus.available ? DS.success : DS.danger }]}>{usernameCheckStatus.message}</Text>
                  </View>
                )}

                <Text style={[styles.inputLabel, { color: isDark ? DS.gray400 : DS.gray500, marginTop: DS.space.md }]}>Bio</Text>
                <TextInput
                  style={[styles.input, styles.inputMulti, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100, color: isDark ? DS.white : DS.gray900 }]}
                  value={formData.bio}
                  onChangeText={(t) => setFormData(prev => ({ ...prev, bio: t }))}
                  placeholder="Tell us about yourself..."
                  placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
                  multiline
                  numberOfLines={3}
                  maxLength={160}
                  selectionColor={DS.primary}
                />
                <Text style={[styles.charCount, { color: isDark ? DS.gray500 : DS.gray400 }]}>{formData.bio.length}/160</Text>

                <Text style={[styles.inputLabel, { color: isDark ? DS.gray400 : DS.gray500, marginTop: DS.space.md }]}>Location</Text>
                <View style={[styles.inputRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                  <Ionicons name="location-outline" size={16} color={DS.primary} />
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: 'transparent', color: isDark ? DS.white : DS.gray900 }]}
                    value={formData.location}
                    onChangeText={(t) => setFormData(prev => ({ ...prev, location: t }))}
                    placeholder={locationDetected?.full || 'Your location'}
                    placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
                    selectionColor={DS.primary}
                  />
                </View>

                <Text style={[styles.inputLabel, { color: isDark ? DS.gray400 : DS.gray500, marginTop: DS.space.md }]}>Privacy</Text>
                {[
                  { key: 'isPublic', icon: 'globe-outline', label: 'Public Profile', desc: 'Allow others to find you' },
                  { key: 'showActivityStatus', icon: 'eye-outline', label: 'Activity Status', desc: 'Show when you are online' },
                  { key: 'allowMessages', icon: 'chatbubbles-outline', label: 'Direct Messages', desc: 'Allow others to message you' },
                  { key: 'notificationsEnabled', icon: 'notifications-outline', label: 'Notifications', desc: 'Receive activity alerts' },
                ].map((pref, i, arr) => (
                  <View key={pref.key}>
                    <View style={styles.prefRow}>
                      <View style={[styles.cardIcon, { backgroundColor: formData[pref.key as keyof typeof formData] ? `${DS.primary}15` : (isDark ? 'rgba(255,255,255,0.06)' : DS.gray100) }]}>
                        <Ionicons name={pref.icon as any} size={16} color={formData[pref.key as keyof typeof formData] ? DS.primary : (isDark ? DS.gray500 : DS.gray400)} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.prefLabel, { color: isDark ? DS.white : DS.gray900 }]}>{pref.label}</Text>
                        <Text style={[styles.prefDesc, { color: isDark ? DS.gray500 : DS.gray400 }]}>{pref.desc}</Text>
                      </View>
                      <Switch
                        value={formData[pref.key as keyof typeof formData] as boolean}
                        onValueChange={(val) => setFormData(prev => ({ ...prev, [pref.key]: val }))}
                        trackColor={{ false: isDark ? '#334155' : DS.gray300, true: DS.primary }}
                        thumbColor={DS.white}
                      />
                    </View>
                    {i < arr.length - 1 && <View style={[styles.prefDivider, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />}
                  </View>
                ))}
              </View>
            </GlassCard>
          </View>
        )}
      </Animated.ScrollView>

      {/* Avatar picker modal */}
      <ActionModal visible={showImagePicker} onClose={() => setShowImagePicker(false)} title="Change Profile Photo" isDark={isDark}>
        <View style={{ padding: DS.space.sm }}>
          {[
            { icon: 'images-outline', label: 'Choose from Library', color: DS.primary, onPress: () => handleImagePick('avatar') },
            { icon: 'camera-outline', label: 'Take Photo', color: DS.warning, onPress: () => handleTakePhoto('avatar') },
            { icon: 'happy-outline', label: 'Pick Emoji', color: DS.accent, onPress: () => { setShowImagePicker(false); setShowEmojiPicker(true); } },
            ...(formData.avatar ? [{ icon: 'trash-outline', label: 'Remove Photo', color: DS.danger, onPress: () => handleRemoveImage('avatar') }] : []),
          ].map((opt, i) => (
            <TouchableOpacity key={i} onPress={opt.onPress} style={styles.pickerOption}>
              <View style={[styles.pickerIcon, { backgroundColor: `${opt.color}20` }]}>
                <Ionicons name={opt.icon as any} size={24} color={opt.color} />
              </View>
              <Text style={[styles.pickerLabel, { color: i === 3 ? DS.danger : (isDark ? DS.white : DS.gray900) }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ActionModal>

      {/* Emoji picker */}
      <Modal visible={showEmojiPicker} transparent animationType="fade" onRequestClose={() => setShowEmojiPicker(false)} statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowEmojiPicker(false)} activeOpacity={1} />
          <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <Animated.View entering={FadeInUp.springify()} style={[styles.modalCard, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
            <View style={styles.modalDrag}><View style={[styles.dragIndicator, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} /></View>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900 }]}>Pick an Emoji</Text>
              <TouchableOpacity onPress={() => setShowEmojiPicker(false)} style={[styles.modalClose, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : DS.gray100 }]}>
                <Ionicons name="close" size={20} color={isDark ? DS.gray300 : DS.gray600} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
              {EMOJI_OPTIONS.map((emoji) => (
                <TouchableOpacity key={emoji} onPress={() => handleEmojiSelect(emoji)} style={[styles.emojiBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                  <Text style={{ fontSize: 26 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </View>
      </Modal>

      <UniversalSpinner
        visible={isSaving || avatarUploading || coverUploading}
        text={avatarUploading ? 'Uploading avatar...' : coverUploading ? 'Uploading cover...' : 'Saving changes...'}
        size="medium"
        overlay={true}
        blur={true}
        section="main"
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
  stickyTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  stickySub: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  topHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: DS.space.lg },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 6 },

  capsule: { borderRadius: DS.radius['2xl'], padding: DS.space.lg, overflow: 'hidden', borderWidth: 1, ...DS.shadow.md },
  capsuleGlowL: { position: 'absolute', top: -80, left: -60, width: 220, height: 220, borderRadius: 110, opacity: 0.9 },
  capsuleGlowR: { position: 'absolute', top: -70, right: -70, width: 200, height: 200, borderRadius: 100, opacity: 0.8 },
  capsuleRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md },
  avatarWrap: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  avatarGlow: { position: 'absolute', width: 92, height: 92, borderRadius: 46, backgroundColor: `${DS.primary}35` },
  avatarRing: { position: 'absolute', width: 88, height: 88, borderRadius: 44, overflow: 'hidden' },
  avatarInner: { width: 80, height: 80, borderRadius: 40, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  editBadge: { position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, borderRadius: 11, backgroundColor: DS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  capsuleName: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3, maxWidth: '70%' },
  verifiedDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: DS.primary, alignItems: 'center', justifyContent: 'center' },
  verifyPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  verifyTick: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  verifyPillText: { fontSize: 10, fontWeight: '700' },
  capsuleHandle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  capsuleStats: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  capsuleStatItem: { alignItems: 'center' },
  capsuleStatValue: { fontSize: 14, fontWeight: '800' },
  capsuleStatLabel: { fontSize: 9, fontWeight: '600', marginTop: 1 },
  capsuleStatDiv: { width: 1, height: 18 },
  capsuleActions: { flexDirection: 'row', gap: 8, marginTop: DS.space.md, alignItems: 'center' },
  actionPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14 },
  actionPrimaryText: { fontSize: 13, fontWeight: '700' },

  ribbon: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, paddingVertical: DS.space.md, paddingHorizontal: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm },
  ribbonIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ribbonText: { fontSize: 12, fontWeight: '600', marginTop: 1, lineHeight: 16 },

  tabBar: { flexDirection: 'row', marginHorizontal: DS.space.lg, padding: 4, borderRadius: DS.radius.full, gap: 2 },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: DS.radius.full },
  tabLabel: { fontSize: 11, fontWeight: '600' },

  glassCard: { borderRadius: DS.radius.lg, overflow: 'hidden', borderWidth: 1, ...DS.shadow.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm },
  cardIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  cardSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  cardPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  cardPillText: { fontSize: 11, fontWeight: '800' },

  barLabel: { fontSize: 11, fontWeight: '600' },
  barValue: { fontSize: 11, fontWeight: '700' },
  barBg: { height: 5, borderRadius: 3, overflow: 'hidden', flex: 1 },
  barFill: { height: '100%', borderRadius: 3 },
  rankBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  rankBadgeText: { fontSize: 12, fontWeight: '800' },

  breakdownIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  breakdownValue: { fontSize: 16, fontWeight: '800' },
  breakdownLabel: { fontSize: 10, fontWeight: '600' },
  insightDivider: { width: 1, height: 30 },

  livePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  liveDot: { width: 5, height: 5, borderRadius: 3 },
  liveText: { fontSize: 9, fontWeight: '800' },
  activityBar: { width: '80%', borderRadius: 4 },
  activityLabel: { fontSize: 10, fontWeight: '600' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: DS.space.md, marginTop: DS.space.sm },
  sectionIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1, opacity: 0.8 },
  sectionAction: { fontSize: 12, fontWeight: '700' },

  postCard: { borderRadius: DS.radius.lg, padding: DS.space.md, borderWidth: 1, ...DS.shadow.sm },
  topicPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, maxWidth: '70%' },
  topicPillText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  postTime: { fontSize: 10, fontWeight: '500' },
  postContent: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  postStats: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: DS.space.sm },
  postStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postStatText: { fontSize: 12, fontWeight: '600' },

  emptyCard: { alignItems: 'center', paddingVertical: DS.space['2xl'], paddingHorizontal: DS.space.lg, borderRadius: DS.radius.lg, borderWidth: 1, gap: 8, ...DS.shadow.sm },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  emptySub: { fontSize: 12, fontWeight: '500', textAlign: 'center', lineHeight: 17 },

  achievementRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12 },
  achievementIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  achievementName: { fontSize: 13, fontWeight: '700' },
  achievementDesc: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  streakCard: { flex: 1, padding: 12, borderRadius: DS.radius.lg, borderWidth: 1, alignItems: 'center', gap: 3 },
  streakIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  streakValue: { fontSize: 20, fontWeight: '800' },
  streakLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  streakBest: { fontSize: 9, fontWeight: '500' },

  topicChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, maxWidth: '100%' },
  topicChipText: { fontSize: 12, fontWeight: '700' },
  bioText: { fontSize: 13, fontWeight: '500', lineHeight: 19 },
  bioLocation: { fontSize: 11, fontWeight: '500' },

  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  settingsRowLabel: { flex: 1, fontSize: 13, fontWeight: '600' },

  editIconBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  inputLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { height: 44, borderRadius: 12, paddingHorizontal: 12, fontSize: 14, fontWeight: '600' },
  inputMulti: { height: 76, paddingTop: 12, textAlignVertical: 'top' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, borderRadius: 12, paddingHorizontal: 12 },
  charCount: { fontSize: 10, fontWeight: '500', textAlign: 'right', marginTop: 4 },
  usernameStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, marginTop: 6 },
  usernameStatusText: { fontSize: 11, fontWeight: '600' },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  prefLabel: { fontSize: 13, fontWeight: '600' },
  prefDesc: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  prefDivider: { height: 1, marginLeft: 38 },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: { width: '100%', maxWidth: 400, borderRadius: DS.radius['2xl'], padding: DS.space.lg, ...DS.shadow.lg, overflow: 'hidden' },
  modalDrag: { alignItems: 'center', paddingVertical: 6 },
  dragIndicator: { width: 36, height: 4, borderRadius: 2 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: DS.space.lg },
  modalTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  modalClose: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pickerOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 6 },
  pickerIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  pickerLabel: { fontSize: 15, fontWeight: '600', flex: 1 },
  emojiBtn: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});