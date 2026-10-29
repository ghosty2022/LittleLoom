import {
  StyleSheet,
  Image,
  Share,
  Text,
  TouchableOpacity,
  useColorScheme,
  StatusBar,
  View,
  LayoutAnimation,
  UIManager,
  Platform,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
  FlatList,
  Modal,
  Pressable,
} from 'react-native';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';

import { BlurView } from 'expo-blur';
import Animated, {
  FadeInUp,
  FadeInDown,
  FadeInRight,
  FadeIn,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import type { CommunityStackParamList } from '../../types/navigation';
import { CommunityUser, Post, useCommunity, INITIAL_TOPICS } from '../../context/CommunityContext';
import { UniversalSpinner } from '../../components/UniversalSpinner';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { useUser } from '../../context/UserContext';
import { supabase } from '@/utils/supabase';
import { subscribeToProfileChanges } from '../../context/AuthContext';

// Fabric detection — LayoutAnimation is a no-op there.
const IS_FABRIC =
  (global as any).nativeFabricUIManager != null ||
  typeof (global as any).RN$Bridgeless !== 'undefined' ||
  typeof (global as any).__turboModuleProxy !== 'undefined';

if (
  Platform.OS === 'android' &&
  !IS_FABRIC &&
  typeof UIManager.setLayoutAnimationEnabledExperimental === 'function'
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = NativeStackScreenProps<CommunityStackParamList, 'CommunityMemberProfile'>;

const DESIGN = {
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
};

const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
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

const TC = DS;

const TOPIC_COLORS: Record<string, string> = {
  topic_1: '#6366f1', topic_2: '#10b981', topic_3: '#ec4899', topic_4: '#f59e0b',
  topic_5: '#fc5c7d', topic_6: '#8b5cf6', topic_7: '#f093fb', topic_8: '#4facfe',
  topic_9: '#ec4899', topic_10: '#43e97b', topic_11: '#ec4899', topic_12: '#6366f1',
};

const ACHIEVEMENTS: Record<string, { emoji: string; name: string; color: string; desc: string }> = {
  first_post: { emoji: '📝', name: 'First Steps', color: '#6366f1', desc: 'Shared their first thread' },
  helpful_parent: { emoji: '💙', name: 'Helpful Parent', color: '#10b981', desc: 'Marked as helpful 10 times' },
  top_contributor: { emoji: '🏆', name: 'Top Contributor', color: '#ec4899', desc: 'Top 1% of contributors' },
  streak_7: { emoji: '🔥', name: '7 Day Streak', color: '#fc5c7d', desc: 'Active for 7 days straight' },
  streak_30: { emoji: '🔥', name: '30 Day Streak', color: '#f093fb', desc: 'Active for 30 days straight' },
  rising_star: { emoji: '⭐', name: 'Rising Star', color: '#f59e0b', desc: 'Gained 100 followers' },
  storyteller: { emoji: '📖', name: 'Storyteller', color: '#8b5cf6', desc: '50+ posts shared' },
  social_butterfly: { emoji: '🦋', name: 'Social Butterfly', color: '#43e97b', desc: 'Connected with 50+ parents' },
  early_bird: { emoji: '🌅', name: 'Early Bird', color: '#ec4899', desc: 'Joined during beta' },
  verified: { emoji: '✅', name: 'Verified', color: '#6366f1', desc: 'Identity verified' },
};

type ProfileTab = 'posts' | 'about' | 'achievements' | 'insights';

const isEmojiAvatar = (avatar: string | undefined): boolean => {
  if (!avatar) return false;
  const emojiRegex =
    /[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FEFF}]|[\u{1F300}-\u{1F5FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{1FB00}-\u{1FBFF}]|[\u{1FC00}-\u{1FCFF}]|[\u{1FD00}-\u{1FDFF}]|[\u{1FE00}-\u{1FEFF}]|[\u{1FF00}-\u{1FFFF}]/u;
  return avatar.length <= 2 && (emojiRegex.test(avatar) || /^[\u{1F000}-\u{1FFFF}]$/u.test(avatar));
};

const safeArray = <T,>(a: T[] | undefined | null): T[] => (Array.isArray(a) ? a : []);
const safeNumber = (n: any, fb = 0): number => {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? v : fb;
};

/* ═══════════════════════════════════════════════════════════════════════════
   SUBCOMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

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

/* Identity Capsule — profile pulse replacing hero */
const IdentityCapsule = React.memo(({
  isDark, user, avatarSize, isFollowingUser, isBlocked, isOwnProfile, followerCount, followingCount, postCount, onAvatarPress, onFollowToggle, onMessage, onShare, onMore
}: any) => {
  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);
  const glow = useSharedValue(0.4);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.06, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1, true);
    rotate.value = withRepeat(withTiming(360, { duration: 9000 }), -1, false);
    glow.value = withRepeat(withSequence(withTiming(0.8, { duration: 1800 }), withTiming(0.4, { duration: 1800 })), -1, true);
  }, []);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: pulse.value }] }));

  if (!user) return null;
  const isOnline = user.onlineStatus === 'online';
  const avatarSource = user.avatar;
  const isAvatarEmoji = isEmojiAvatar(avatarSource);

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()}>
      <View style={[styles.capsule, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient
          colors={isDark
            ? ['rgba(99,102,241,0.20)', 'rgba(236,72,153,0.10)', 'rgba(139,92,246,0.05)']
            : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.06)', 'rgba(139,92,246,0.03)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <LinearGradient colors={[`${DS.primary}${isDark ? '45' : '28'}`, 'transparent']}
          style={styles.capsuleGlowL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none" />
        <LinearGradient colors={[`${DS.accent}${isDark ? '35' : '22'}`, 'transparent']}
          style={styles.capsuleGlowR} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} pointerEvents="none" />

        <View style={styles.capsuleRow}>
          <PressableScale onPress={onAvatarPress} activeScale={0.94}>
            <View style={styles.avatarWrap}>
              <Animated.View style={[styles.avatarGlow, glowStyle]} />
              <Animated.View style={[styles.avatarRing, ringStyle]}>
                <LinearGradient colors={[DS.primary, DS.accent, DS.warning, DS.primary]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
              <View style={[styles.avatarInner, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
                {avatarSource && !isAvatarEmoji ? (
                  <Image source={{ uri: avatarSource }} style={{ width: avatarSize - 12, height: avatarSize - 12, borderRadius: (avatarSize - 12) / 2 }} resizeMode="cover" />
                ) : (
                  <View style={{ width: avatarSize - 12, height: avatarSize - 12, borderRadius: (avatarSize - 12) / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: `${DS.primary}20` }}>
                    <Text style={{ fontSize: (avatarSize - 12) * 0.42, fontWeight: '800', color: DS.primary }}>
                      {isAvatarEmoji ? avatarSource : user.displayName?.charAt(0)?.toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
              </View>
              {isOnline && (
                <View style={[styles.onlineBadge, { backgroundColor: DS.success, borderColor: isDark ? DS.darkSurface : DS.white }]} />
              )}
            </View>
          </PressableScale>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.capsuleName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                {user.displayName || 'Parent'}
              </Text>
              {user.isVerified && (
                <View style={styles.verifiedDot}>
                  <Ionicons name="checkmark" size={10} color={DS.white} />
                </View>
              )}
            </View>
            <Text style={[styles.capsuleHandle, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
              {user.handle || '@parent'}
            </Text>
            <View style={styles.capsuleStats}>
              <View style={styles.capsuleStatItem}>
                <Text style={[styles.capsuleStatValue, { color: DS.primary }]}>{postCount}</Text>
                <Text style={[styles.capsuleStatLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>posts</Text>
              </View>
              <View style={[styles.capsuleStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
              <PressableScale onPress={() => {}} activeScale={0.94}>
                <View style={styles.capsuleStatItem}>
                  <Text style={[styles.capsuleStatValue, { color: DS.accent }]}>{followerCount}</Text>
                  <Text style={[styles.capsuleStatLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>followers</Text>
                </View>
              </PressableScale>
              <View style={[styles.capsuleStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
              <View style={styles.capsuleStatItem}>
                <Text style={[styles.capsuleStatValue, { color: DS.success }]}>{followingCount}</Text>
                <Text style={[styles.capsuleStatLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>following</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.capsuleActions}>
          {!isOwnProfile ? (
            <>
              <PressableScale onPress={onFollowToggle} disabled={isBlocked} activeScale={0.94} style={{ flex: 1 }}>
                <LinearGradient
                  colors={isFollowingUser ? [isDark ? DS.darkSurface : DS.gray100, isDark ? DS.darkSurface : DS.gray200] : [DS.primary, DS.accent]}
                  style={styles.actionPrimary}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                  <Ionicons name={isFollowingUser ? 'checkmark' : 'person-add'} size={15} color={isFollowingUser ? (isDark ? DS.gray300 : DS.gray600) : DS.white} />
                  <Text style={[styles.actionPrimaryText, { color: isFollowingUser ? (isDark ? DS.gray300 : DS.gray600) : DS.white }]}>
                    {isBlocked ? 'Blocked' : isFollowingUser ? 'Following' : 'Follow'}
                  </Text>
                </LinearGradient>
              </PressableScale>
              <PressableScale onPress={onMessage} disabled={isBlocked} activeScale={0.94}>
                <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                  <Ionicons name="chatbubbles" size={18} color={isBlocked ? DS.gray400 : DS.primary} />
                </View>
              </PressableScale>
              <PressableScale onPress={onShare} activeScale={0.94}>
                <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                  <Ionicons name="share-outline" size={18} color={DS.primary} />
                </View>
              </PressableScale>
              <PressableScale onPress={onMore} activeScale={0.94}>
                <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                  <Ionicons name="ellipsis-horizontal" size={18} color={DS.primary} />
                </View>
              </PressableScale>
            </>
          ) : (
            <>
              <PressableScale onPress={onShare} activeScale={0.94} style={{ flex: 1 }}>
                <View style={[styles.actionPrimary, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                  <Ionicons name="share-outline" size={15} color={DS.primary} />
                  <Text style={[styles.actionPrimaryText, { color: DS.primary }]}>Share Profile</Text>
                </View>
              </PressableScale>
              <PressableScale onPress={() => {}} activeScale={0.94}>
                <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                  <Ionicons name="settings-outline" size={18} color={DS.primary} />
                </View>
              </PressableScale>
            </>
          )}
        </View>
      </View>
    </Animated.View>
  );
});

/* Bio Ribbon */
const BioRibbon = React.memo(({ isDark, user, onPress }: any) => {
  if (!user?.bio && !user?.country) return null;
  return (
    <Animated.View entering={FadeInUp.delay(60).springify()}>
      <PressableScale onPress={onPress} activeScale={0.98}>
        <View style={[styles.bioRibbon, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <View style={[styles.bioIcon, { backgroundColor: `${DS.primary}15` }]}>
            <Ionicons name="sparkles" size={14} color={DS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            {user?.bio ? (
              <Text style={[styles.bioText, { color: isDark ? DS.gray200 : DS.gray700 }]} numberOfLines={2}>
                {user.bio}
              </Text>
            ) : (
              <Text style={[styles.bioText, { color: isDark ? DS.gray400 : DS.gray500, fontStyle: 'italic' }]} numberOfLines={1}>
                No bio yet
              </Text>
            )}
            {user?.country && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                <Ionicons name="location-outline" size={11} color={isDark ? DS.gray500 : DS.gray400} />
                <Text style={[styles.bioLocation, { color: isDark ? DS.gray500 : DS.gray400 }]}>{user.country}</Text>
              </View>
            )}
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
});

/* Insight Ribbon */
const InsightRibbon = React.memo(({ isDark, icon, color, label, text, onPress }: any) => (
  <Animated.View entering={FadeInUp.delay(100).springify()}>
    <PressableScale onPress={onPress} activeScale={0.98}>
      <View style={[styles.ribbon, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={[styles.ribbonIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={15} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ribbonLabel, { color }]}>{label}</Text>
          <Text style={[styles.ribbonText, { color: isDark ? DS.gray300 : DS.gray700 }]} numberOfLines={2}>{text}</Text>
        </View>
        {onPress && <Ionicons name="chevron-forward" size={15} color={isDark ? DS.gray500 : DS.gray400} />}
      </View>
    </PressableScale>
  </Animated.View>
));

/* Tab Bar */
const TabBar = React.memo(({ tabs, activeTab, onChange, isDark }: any) => (
  <View style={[styles.tabBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
    {tabs.map((tab: any) => {
      const active = activeTab === tab.key;
      return (
        <TouchableOpacity
          key={tab.key}
          onPress={() => onChange(tab.key)}
          style={[styles.tabItem, active && { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : DS.white, ...DS.shadow.sm }]}
          activeOpacity={0.8}
        >
          <Ionicons name={tab.icon as any} size={14} color={active ? DS.primary : (isDark ? DS.gray400 : DS.gray500)} />
          <Text style={[styles.tabLabel, { color: active ? DS.primary : (isDark ? DS.gray400 : DS.gray500) }, active && { fontWeight: '700' }]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
));

/* GlassCard */
const GlassCard = React.memo(({ children, style, isDark, delay = 0 }: any) => (
  <Animated.View entering={FadeInUp.delay(delay).springify()} style={[styles.glassCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }, style]}>
    <LinearGradient
      colors={isDark ? ['rgba(255,255,255,0.02)', 'transparent'] : ['rgba(255,255,255,0.4)', 'transparent']}
      style={StyleSheet.absoluteFill}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
    />
    {children}
  </Animated.View>
));

/* Post Card */
const PostCard = React.memo(({ post, index, onPressPost, isDark }: any) => {
  const topicColor = TOPIC_COLORS[post.topicId] || DS.primary;
  return (
    <Animated.View entering={FadeInUp.delay(Math.min(index, 6) * 40).springify()}>
      <PressableScale onPress={() => onPressPost(post.id)} activeScale={0.98}>
        <View style={[styles.postCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={[styles.topicPill, { backgroundColor: `${topicColor}15` }]}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: topicColor }} />
              <Text style={[styles.topicPillText, { color: topicColor }]} numberOfLines={1}>{post.topic || 'General'}</Text>
            </View>
            <Text style={[styles.postTime, { color: isDark ? DS.gray500 : DS.gray400 }]}>{post.time}</Text>
          </View>
          <Text style={[styles.postContent, { color: isDark ? DS.gray200 : DS.gray800 }]} numberOfLines={3}>{post.content}</Text>
          {post.images && post.images.length > 0 && (
            <View style={styles.postImgWrap}>
              <Image source={{ uri: post.images[0] }} style={styles.postImg} resizeMode="cover" />
            </View>
          )}
          <View style={styles.postStats}>
            {[
              { icon: 'heart', value: post.likes, color: post.isLiked ? DS.danger : (isDark ? DS.gray500 : DS.gray400) },
              { icon: 'chatbubble', value: post.commentsCount, color: isDark ? DS.gray500 : DS.gray400 },
              { icon: 'repeat', value: post.reposts || 0, color: isDark ? DS.gray500 : DS.gray400 },
              { icon: 'eye', value: post.viewCount || 0, color: isDark ? DS.gray500 : DS.gray400 },
            ].map((s, i) => (
              <View key={i} style={styles.postStat}>
                <Ionicons name={s.icon as any} size={13} color={s.color} />
                <Text style={[styles.postStatText, { color: s.color }]}>{s.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
});

/* Hero Skeleton */
const CapsuleSkeleton = React.memo(({ isDark, avatarSize }: any) => (
  <View style={[styles.capsule, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
    <View style={styles.capsuleRow}>
      <View style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ height: 18, width: 140, borderRadius: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }} />
        <View style={{ height: 12, width: 100, borderRadius: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }} />
        <View style={{ flexDirection: 'row', gap: 20, marginTop: 4 }}>
          {[0, 1, 2].map(i => (
            <View key={i} style={{ gap: 4 }}>
              <View style={{ height: 14, width: 28, borderRadius: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }} />
              <View style={{ height: 10, width: 44, borderRadius: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }} />
            </View>
          ))}
        </View>
      </View>
    </View>
  </View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function CommunityMemberProfileScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const {
    currentUser, getUserById, getUserPosts, followUser, unfollowUser, isFollowing,
    blockUser, isUserBlocked, getFollowers, getFollowing, getAllUsers,
    refreshFeed, syncUserProfileAcrossPosts,
  } = useCommunity();
  const { communityProfile } = useUser();
  const { themeColors, fullThemeColors, darkMode, triggerHaptic } = useCustomization();
  const colorScheme = useColorScheme();
  const isDark = darkMode ?? (colorScheme === 'dark');
  const sweetAlert = useSweetAlert();

  const insets = useSafeAreaInsets();
  const { width: SCREEN_W } = useWindowDimensions();
  const scrollY = useSharedValue(0);

  const isCompact = SCREEN_W < 360;
  const isTablet = SCREEN_W >= 768;
  const avatarSize = isTablet ? 88 : Math.max(72, Math.min(88, SCREEN_W * 0.22));

  const [user, setUser] = useState<CommunityUser | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [isHydrating, setIsHydrating] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);

  const isOwnProfile = currentUser?.id === userId;
  const allUsers = useMemo(() => getAllUsers(), [getAllUsers]);

  const isLoadingRef = useRef(false);
  const initialLoadDone = useRef(false);
  const isMountedRef = useRef(true);
  const profileReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentUser?.id || !communityProfile) return;
    const hasChanges =
      communityProfile.displayName !== currentUser.displayName ||
      communityProfile.handle !== currentUser.handle ||
      communityProfile.avatar !== currentUser.avatar;
    if (hasChanges) {
      syncUserProfileAcrossPosts(currentUser.id, {
        displayName: communityProfile.displayName,
        handle: communityProfile.handle,
        avatar: communityProfile.avatar,
      });
    }
  }, [communityProfile, currentUser, syncUserProfileAcrossPosts]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (profileReloadTimerRef.current) clearTimeout(profileReloadTimerRef.current);
    };
  }, []);

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 100], [-10, 0], Extrapolation.CLAMP) }],
  }));

  const userPostList = useMemo(() => getUserPosts(userId), [userId, getUserPosts]);

  /* Derived */
  const engagementInsights = useMemo(() => {
    const totalLikes = userPostList.reduce((s, p) => s + p.likes, 0);
    const totalComments = userPostList.reduce((s, p) => s + p.commentsCount, 0);
    const totalViews = userPostList.reduce((s, p) => s + p.viewCount, 0);
    return [
      { icon: '❤️', label: 'Likes', value: totalLikes, color: DS.danger },
      { icon: '💬', label: 'Comments', value: totalComments, color: DS.info },
      { icon: '👁️', label: 'Views', value: totalViews, color: DS.primary },
    ];
  }, [userPostList]);

  const influenceMetrics = useMemo(() => {
    const totalPosts = userPostList.length;
    const totalLikes = userPostList.reduce((s, p) => s + (p.likes || 0), 0);
    const totalComments = userPostList.reduce((s, p) => s + (p.commentsCount || 0), 0);
    const totalHelpful = userPostList.reduce((s, p) => s + (p.helpfulVotes || 0), 0);
    const totalViews = userPostList.reduce((s, p) => s + (p.viewCount || 0), 0);
    const avgEngagement = totalPosts > 0 ? Math.min(100, Math.round(((totalLikes + totalComments * 2) / totalPosts) * 2)) : 0;
    const consistency = Math.min(100, Math.round((totalPosts / Math.max(1, 30)) * 100));
    const helpful = Math.min(100, Math.round((totalHelpful / Math.max(1, totalPosts)) * 15));
    const reach = Math.min(100, Math.round((totalViews / Math.max(1, totalPosts * 10)) * 100));
    return [
      { label: 'Engagement', value: avgEngagement, color: DS.primary, icon: 'flash' },
      { label: 'Consistency', value: consistency, color: DS.accent, icon: 'calendar' },
      { label: 'Helpful', value: helpful, color: DS.success, icon: 'heart' },
      { label: 'Reach', value: reach, color: DS.warning, icon: 'eye' },
    ];
  }, [userPostList]);

  const communityInfluence = useMemo(() => {
    const userPostCount = userPostList.length;
    const allPostCounts = allUsers.map((u) => getUserPosts(u.id).length);
    const sortedCounts = [...allPostCounts].sort((a, b) => b - a);
    const rank = sortedCounts.findIndex((c) => c <= userPostCount) + 1;
    const percentile = Math.min(100, Math.round((1 - rank / Math.max(1, allUsers.length)) * 100));
    const totalEngagement = userPostList.reduce((s, p) => s + p.likes + p.commentsCount * 2, 0);
    let rankLabel = 'New Parent';
    if (userPostCount > 100 && totalEngagement > 500) rankLabel = 'Legendary Parent';
    else if (userPostCount > 50 && totalEngagement > 200) rankLabel = 'Gold Parent';
    else if (userPostCount > 20 && totalEngagement > 50) rankLabel = 'Silver Parent';
    else if (userPostCount > 5) rankLabel = 'Bronze Parent';
    return { score: Math.min(100, Math.round(percentile + 20)), rank: rankLabel, percentile };
  }, [userPostList, allUsers, getUserPosts, userId]);

  const contentHighlights = useMemo(() => {
    const sorted = [...userPostList].sort((a, b) => b.likes - a.likes);
    const mostLiked = sorted[0]?.likes || 0;
    const mostCommented = Math.max(...userPostList.map((p) => p.commentsCount), 0);
    const totalViews = userPostList.reduce((s, p) => s + (p.viewCount || 0), 0);
    const totalInteractions = userPostList.reduce((s, p) => s + p.likes + p.commentsCount, 0);
    const avgEngagement = totalViews > 0 ? Math.min(100, Math.round((totalInteractions / totalViews) * 100)) : 0;
    return { topPost: sorted[0] || null, mostLiked, mostCommented, avgEngagement };
  }, [userPostList]);

  const activityPattern = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const now = new Date();
    return days.map((day, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (6 - i));
      const dayPosts = userPostList.filter((p) => new Date(p.timestamp).toDateString() === date.toDateString());
      const activity = dayPosts.length + dayPosts.reduce((s, p) => s + p.likes * 0.3, 0);
      return { day: day.slice(0, 1), activity: Math.round(activity), posts: dayPosts.length };
    });
  }, [userPostList]);

  const contentBreakdown = useMemo(() => ({
    posts: userPostList.length,
    comments: userPostList.reduce((s, p) => s + (p.commentsCount || 0), 0),
    reactions: userPostList.reduce((s, p) => s + (p.likes || 0), 0),
    shares: userPostList.reduce((s, p) => s + (p.reposts || 0), 0),
  }), [userPostList]);

  const topicBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    userPostList.forEach((p) => { counts[p.topicId] = (counts[p.topicId] || 0) + 1; });
    const total = userPostList.length || 1;
    return Object.entries(counts)
      .map(([topicId, count]) => ({
        topicId, count,
        color: TOPIC_COLORS[topicId] || DS.primary,
        label: INITIAL_TOPICS.find((t) => t.id === topicId)?.name || topicId.replace('topic_', 'Topic '),
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [userPostList]);

  const contributionStreak = useMemo(() => {
    const now = new Date();
    const weeks: boolean[] = [];
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const hasActivity = userPostList.some((p) => {
        const d = new Date(p.timestamp);
        return d >= weekStart && d < weekEnd;
      });
      weeks.push(hasActivity);
    }
    let current = 0;
    for (let i = weeks.length - 1; i >= 0 && weeks[i]; i--) current++;
    let longest = 0, temp = 0;
    for (let i = 0; i < weeks.length; i++) {
      if (weeks[i]) temp++;
      else { longest = Math.max(longest, temp); temp = 0; }
    }
    longest = Math.max(longest, temp);
    return { current, longest, weeks };
  }, [userPostList]);

  const tabs = useMemo(() => [
    { key: 'posts' as ProfileTab, label: 'Posts', icon: 'document-text-outline' },
    { key: 'about' as ProfileTab, label: 'About', icon: 'information-circle-outline' },
    { key: 'achievements' as ProfileTab, label: 'Badges', icon: 'trophy-outline' },
    { key: 'insights' as ProfileTab, label: 'Insights', icon: 'analytics-outline' },
  ], []);

  /* Lifecycle */
  useEffect(() => {
    if (userId && !initialLoadDone.current) {
      loadUserData();
      initialLoadDone.current = true;
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      if (userId && !isLoadingRef.current) loadUserData();
      return () => {};
    }, [userId])
  );

  /* Realtime profile-change: refresh this member's view */
  // Fires when *any* profile changes — we only react if it's the
  // member we're viewing. Re-runs loadUserData so avatar/name/bio
  // update instantly. Also handles my own edits affecting posts
  // (the context's `syncUserProfileAcrossPosts` handles that case).
  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeToProfileChanges((payload) => {
      if (payload.userId === userId) {
        // Small debounce so a save that updates 3 fields doesn't
        // trigger 3 reloads.
        if (profileReloadTimerRef.current) clearTimeout(profileReloadTimerRef.current);
        profileReloadTimerRef.current = setTimeout(() => {
          profileReloadTimerRef.current = null;
          if (isMountedRef.current) loadUserData();
        }, 120);
      }
    });
    return unsub;
  }, [userId]);

  // Re-sync topics when the context's cached user changes (e.g. that
  // user just edited their topics on another screen / device).
  // Re-sync topics whenever the context updates them for this user.
  // Depend on the actual array reference, not on `user` (which changes
  // for unrelated reasons and would re-fire this needlessly).
  const contextUser = getUserById(userId);
  const contextUserTopicsKey = useMemo(
    () => (contextUser?.selectedTopics || []).join('|'),
    [contextUser?.selectedTopics],
  );
  useEffect(() => {
    if (!contextUser || !Array.isArray(contextUser.selectedTopics)) return;
    const next = contextUser.selectedTopics;
    if (next.length === 0) return;
    setUser((prev) => {
      if (!prev) return prev;
      const prevKey = (prev.selectedTopics || []).join('|');
      const nextKey = next.join('|');
      if (prevKey === nextKey) return prev;
      return { ...prev, selectedTopics: next };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextUserTopicsKey]);

  const loadUserData = async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsHydrating(true);
    try {
      let targetUser = getUserById(userId);
      if (userId) {
        try {
          const { data: profileRow, error: profileErr } = await supabase
            .from('profiles')
            .select('id, full_name, community_display_name, community_handle, community_username, community_bio, community_avatar, avatar_url, community_cover, is_verified, community_selected_topics, created_at')
            .eq('id', userId)
            .maybeSingle();
          if (!profileErr && profileRow) {
            const fallbackHandle = (profileRow.community_handle || '').toString().replace(/^@+/, '') ||
              (profileRow.community_username || '').toString() ||
              (profileRow.full_name || 'parent').toLowerCase().replace(/\s+/g, '_');
            const fromDb: CommunityUser = {
              id: profileRow.id,
              displayName: profileRow.community_display_name || profileRow.full_name || 'Parent',
              handle: `@${fallbackHandle}`,
              avatar: profileRow.community_avatar || profileRow.avatar_url || '👤',
              coverPhoto: profileRow.community_cover || undefined,
              isVerified: !!profileRow.is_verified,
              bio: profileRow.community_bio || '',
              location: '', country: 'Unknown', onlineStatus: 'offline',
              lastActive: new Date().toISOString(),
              stats: targetUser?.stats || { posts: 0, followers: 0, following: 0, helpful: 0, streakDays: 0, lastStreakDate: new Date().toISOString() },
              achievements: targetUser?.achievements || [],
              selectedTopics: Array.isArray(profileRow.community_selected_topics) ? profileRow.community_selected_topics : (targetUser?.selectedTopics || []),
              isFollowing: targetUser?.isFollowing,
              following: targetUser?.following,
              followers: targetUser?.followers,
            };
            if (!targetUser) targetUser = fromDb;
            else {
              targetUser = {
                ...targetUser,
                displayName: fromDb.displayName || targetUser.displayName,
                handle: fromDb.handle || targetUser.handle,
                avatar: fromDb.avatar || targetUser.avatar,
                bio: fromDb.bio || targetUser.bio,
                isVerified: fromDb.isVerified,
                selectedTopics: fromDb.selectedTopics && fromDb.selectedTopics.length > 0 ? fromDb.selectedTopics : targetUser.selectedTopics,
              };
            }
          }
        } catch (e) {
          if (__DEV__) console.warn('[Profile] Supabase fallback failed:', e);
        }
      }
      if (targetUser) {
        setUser(targetUser);
        setUserPosts(getUserPosts(userId));
        setIsFollowingUser(isFollowing(userId));
        setIsBlocked(isUserBlocked(userId));
        const followers = await getFollowers(userId);
        const following = await getFollowing(userId);
        if (isMountedRef.current) {
          setFollowerCount(followers.length);
          setFollowingCount(following.length);
        }
      } else {
        sweetAlert.alert('Not Found', 'User not found', 'warning');
        navigation.goBack();
      }
    } catch (e) {
      if (__DEV__) console.warn('[Profile] loadUserData error:', e);
      sweetAlert.error('Error', 'Failed to load profile');
    } finally {
      setIsHydrating(false);
      isLoadingRef.current = false;
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshFeed();
      await loadUserData();
    } catch (e) {
      if (__DEV__) console.warn('[Profile] refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  }, [refreshFeed]);

  const handleFollowToggle = useCallback(async () => {
    if (isOwnProfile || !user) return;
    triggerHaptic('medium');
    try {
      if (isFollowingUser) {
        await unfollowUser(userId);
        setFollowerCount((p) => Math.max(0, p - 1));
        setIsFollowingUser(false);
        sweetAlert.toast('Unfollowed', `You unfollowed ${user.displayName}`);
      } else {
        await followUser(userId);
        setFollowerCount((p) => p + 1);
        setIsFollowingUser(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        sweetAlert.toast('Following', `Now following ${user.displayName}`);
      }
    } catch {
      sweetAlert.error('Error', 'Failed to update follow status');
    }
  }, [isOwnProfile, user, isFollowingUser, unfollowUser, followUser, userId, sweetAlert, triggerHaptic]);

  const handleMessage = useCallback(() => {
    if (!user || isBlocked) return;
    triggerHaptic('light');
    navigation.navigate('Chat' as never, { userId } as never);
  }, [user, isBlocked, navigation, triggerHaptic, userId]);

  const handleMoreOptions = useCallback(() => {
    if (!user) return;
    sweetAlert.confirm(
      user.displayName || 'User',
      'What would you like to do?',
      () => {
        blockUser(userId);
        if (isBlocked) { setIsBlocked(false); sweetAlert.success('Unblocked', `${user.displayName} has been unblocked`); }
        else { setIsBlocked(true); setIsFollowingUser(false); sweetAlert.alert('Blocked', `${user.displayName} has been blocked`, 'warning'); }
      },
      () => handleShareProfile(),
      isBlocked ? 'Unblock' : 'Block',
      'Share Profile'
    );
  }, [user, isBlocked, blockUser, userId, sweetAlert]);

  const handleShareProfile = useCallback(async () => {
    if (!user) return;
    try {
      triggerHaptic('medium');
      await Share.share({
        message: `Check out ${user.displayName} on LittleLoom! ${user.handle}`,
        title: `${user.displayName}'s Profile`,
      });
    } catch (e) {
      if (__DEV__) console.warn('Share error:', e);
    }
  }, [user, triggerHaptic]);

  const handleTabChange = useCallback((tab: ProfileTab) => {
    if (!IS_FABRIC) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { 'worklet'; scrollY.value = event.contentOffset.y; },
  });

  const handlePressPost = useCallback((postId: string) => {
    navigation.navigate('PostDetail' as never, { postId } as never);
  }, [navigation]);

  /* ── RENDER TABS ── */
  const renderPostsTab = () => (
    <Animated.View entering={FadeInUp.springify()} style={{ gap: 10, paddingHorizontal: DS.space.lg }}>
      {/* Engagement pulse strip */}
      <GlassCard isDark={isDark}>
        <View style={{ flexDirection: 'row', padding: DS.space.md }}>
          {engagementInsights.map((ins, i) => (
            <React.Fragment key={ins.label}>
              <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                <Text style={{ fontSize: 18 }}>{ins.icon}</Text>
                <Text style={[styles.insightValue, { color: ins.color }]}>{ins.value}</Text>
                <Text style={[styles.insightLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>{ins.label}</Text>
              </View>
              {i < engagementInsights.length - 1 && <View style={[styles.insightDivider, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />}
            </React.Fragment>
          ))}
        </View>
      </GlassCard>

      {/* Influence bars */}
      <GlassCard isDark={isDark} delay={60}>
        <View style={{ padding: DS.space.md }}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.cardIcon, { backgroundColor: `${DS.primary}15` }]}>
                <Ionicons name="analytics" size={14} color={DS.primary} />
              </View>
              <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900 }]}>Influence</Text>
            </View>
            <View style={[styles.cardPill, { backgroundColor: `${DS.primary}15` }]}>
              <Text style={[styles.cardPillText, { color: DS.primary }]}>
                {Math.round(influenceMetrics.reduce((a, b) => a + b.value, 0) / influenceMetrics.length)}
              </Text>
            </View>
          </View>
          <View style={{ gap: 8, marginTop: DS.space.sm }}>
            {influenceMetrics.map((m, i) => (
              <View key={m.label} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name={m.icon as any} size={11} color={m.color} />
                  <Text style={[styles.barLabel, { color: m.color, flex: 1 }]}>{m.label}</Text>
                  <Text style={[styles.barValue, { color: m.color }]}>{m.value}%</Text>
                </View>
                <View style={[styles.barBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                  <Animated.View
                    entering={FadeInRight.delay(100 + i * 60).springify()}
                    style={[styles.barFill, { width: `${m.value}%`, backgroundColor: m.color }]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      </GlassCard>

      {/* Community standing */}
      <GlassCard isDark={isDark} delay={100}>
        <View style={{ padding: DS.space.md }}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.cardIcon, { backgroundColor: `${'#8b5cf6'}15` }]}>
                <Ionicons name="trophy" size={14} color="#8b5cf6" />
              </View>
              <View>
                <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900 }]}>Community Standing</Text>
                <Text style={[styles.cardSub, { color: isDark ? DS.gray500 : DS.gray400 }]}>Top {communityInfluence.percentile}% of {allUsers.length}</Text>
              </View>
            </View>
            <View style={[styles.cardPill, { backgroundColor: '#8b5cf615' }]}>
              <Text style={[styles.cardPillText, { color: '#8b5cf6' }]}>{communityInfluence.score}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: DS.space.md }}>
            <View style={[styles.rankBadge, { backgroundColor: '#8b5cf615' }]}>
              <Text style={[styles.rankBadgeText, { color: '#8b5cf6' }]}>{communityInfluence.rank}</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[styles.barLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Progress</Text>
                <Text style={[styles.barValue, { color: '#8b5cf6' }]}>{communityInfluence.percentile}%</Text>
              </View>
              <View style={[styles.barBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                <View style={[styles.barFill, { width: `${communityInfluence.percentile}%`, backgroundColor: '#8b5cf6' }]} />
              </View>
            </View>
          </View>
        </View>
      </GlassCard>

      {/* Content highlights */}
      {contentHighlights.topPost && (
        <GlassCard isDark={isDark} delay={140}>
          <View style={{ padding: DS.space.md }}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900 }]}>Top Post</Text>
              <View style={[styles.cardPill, { backgroundColor: `${TOPIC_COLORS[contentHighlights.topPost.topicId] || DS.primary}15` }]}>
                <Text style={[styles.cardPillText, { color: TOPIC_COLORS[contentHighlights.topPost.topicId] || DS.primary }]}>
                  {contentHighlights.topPost.likes} ❤️
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => handlePressPost(contentHighlights.topPost!.id)} activeOpacity={0.8} style={{ marginTop: DS.space.sm }}>
              <Text style={[styles.topPostContent, { color: isDark ? DS.gray200 : DS.gray800 }]} numberOfLines={2}>
                {contentHighlights.topPost.content}
              </Text>
              <View style={[styles.topPostStats, { marginTop: DS.space.sm }]}>
                <View style={styles.postStat}>
                  <Ionicons name="heart" size={12} color={DS.danger} />
                  <Text style={[styles.postStatText, { color: DS.danger }]}>{contentHighlights.topPost.likes}</Text>
                </View>
                <View style={styles.postStat}>
                  <Ionicons name="chatbubble" size={12} color={DS.primary} />
                  <Text style={[styles.postStatText, { color: DS.primary }]}>{contentHighlights.topPost.commentsCount}</Text>
                </View>
                <View style={styles.postStat}>
                  <Ionicons name="eye" size={12} color={isDark ? DS.gray500 : DS.gray400} />
                  <Text style={[styles.postStatText, { color: isDark ? DS.gray500 : DS.gray400 }]}>{contentHighlights.topPost.viewCount}</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </GlassCard>
      )}

      {/* Content breakdown */}
      <GlassCard isDark={isDark} delay={180}>
        <View style={{ padding: DS.space.md }}>
          <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900, marginBottom: DS.space.sm }]}>Content Breakdown</Text>
          <View style={{ flexDirection: 'row' }}>
            {[
              { label: 'Posts', value: contentBreakdown.posts, color: DS.primary, icon: 'document-text' },
              { label: 'Comments', value: contentBreakdown.comments, color: DS.info, icon: 'chatbubble' },
              { label: 'Reactions', value: contentBreakdown.reactions, color: DS.accent, icon: 'heart' },
              { label: 'Shares', value: contentBreakdown.shares, color: DS.success, icon: 'share' },
            ].map((item, i) => (
              <React.Fragment key={item.label}>
                <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                  <View style={[styles.breakdownIcon, { backgroundColor: `${item.color}15` }]}>
                    <Ionicons name={item.icon as any} size={14} color={item.color} />
                  </View>
                  <Text style={[styles.breakdownValue, { color: item.color }]}>{item.value}</Text>
                  <Text style={[styles.breakdownLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>{item.label}</Text>
                </View>
                {i < 3 && <View style={[styles.insightDivider, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />}
              </React.Fragment>
            ))}
          </View>
        </View>
      </GlassCard>

      {/* Activity pattern */}
      <GlassCard isDark={isDark} delay={220}>
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
                  <View style={[styles.activityBar, {
                    height,
                    backgroundColor: p.activity > maxVal * 0.7 ? DS.primary : p.activity > maxVal * 0.3 ? `${DS.primary}80` : `${DS.primary}40`,
                  }]} />
                  <Text style={[styles.activityLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>{p.day}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </GlassCard>

      {/* All threads */}
      <View style={{ marginTop: DS.space.md }}>
        <View style={styles.sectionTitleRow}>
          <View style={[styles.cardIcon, { backgroundColor: `${DS.primary}15` }]}>
            <Ionicons name="document-text" size={14} color={DS.primary} />
          </View>
          <Text style={[styles.sectionTitleText, { color: isDark ? DS.white : DS.gray900 }]}>All Threads</Text>
          <View style={[styles.cardPill, { backgroundColor: `${DS.primary}15`, marginLeft: 'auto' }]}>
            <Text style={[styles.cardPillText, { color: DS.primary }]}>{userPostList.length}</Text>
          </View>
        </View>
        {userPostList.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
            <Ionicons name="document-text-outline" size={32} color={DS.primary} />
            <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>No threads yet</Text>
            <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>This parent hasn't shared any stories yet.</Text>
          </View>
        ) : (
          userPostList.map((p, i) => <PostCard key={p.id} post={p} index={i} onPressPost={handlePressPost} isDark={isDark} />)
        )}
      </View>
    </Animated.View>
  );

  const renderAboutTab = () => {
    if (!user) return null;
    const totalComments = userPostList.reduce((s, p) => s + p.commentsCount, 0);
    return (
      <Animated.View entering={FadeInUp.springify()} style={{ gap: 10, paddingHorizontal: DS.space.lg }}>
        <GlassCard isDark={isDark}>
          <View style={{ padding: DS.space.md, gap: 12 }}>
            <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900 }]}>Profile Info</Text>
            {[
              { icon: 'time-outline', color: DS.primary, label: 'Member Since', value: (user as any).addedAt ? new Date((user as any).addedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '2024' },
              { icon: 'flame-outline', color: DS.warning, label: 'Active Streak', value: `${user.stats?.streakDays || 0} days` },
              { icon: 'heart-outline', color: DS.success, label: 'Total Likes', value: `${userPostList.reduce((s, p) => s + p.likes, 0)}` },
              { icon: 'chatbubble-outline', color: '#8b5cf6', label: 'Total Comments', value: `${totalComments}` },
            ].map((item, i, arr) => (
              <React.Fragment key={item.label}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.breakdownIcon, { backgroundColor: `${item.color}15` }]}>
                    <Ionicons name={item.icon as any} size={16} color={item.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.insightLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>{item.label}</Text>
                    <Text style={[styles.infoValue, { color: isDark ? DS.white : DS.gray900 }]}>{item.value}</Text>
                  </View>
                </View>
                {i < arr.length - 1 && <View style={[styles.insightDivider, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />}
              </React.Fragment>
            ))}
          </View>
        </GlassCard>

        {user.selectedTopics && user.selectedTopics.length > 0 && (
          <GlassCard isDark={isDark} delay={80}>
            <View style={{ padding: DS.space.md }}>
              <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900, marginBottom: DS.space.md }]}>Interested In</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {user.selectedTopics.map((topicId) => {
                  const topic = INITIAL_TOPICS.find((t) => t.id === topicId);
                  const color = topic?.color || TOPIC_COLORS[topicId] || DS.primary;
                  const name = topic?.name || topicId.replace('topic_', 'Topic ');
                  return (
                    <View key={topicId} style={[styles.topicChip, { backgroundColor: `${color}20` }]}>
                      <Text style={[styles.topicChipText, { color }]} numberOfLines={1}>
                        {topic?.emoji ? `${topic.emoji} ${name}` : name}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </GlassCard>
        )}
      </Animated.View>
    );
  };

  const renderAchievementsTab = () => {
    const achievements = user?.achievements || [];
    return (
      <Animated.View entering={FadeInUp.springify()} style={{ gap: 10, paddingHorizontal: DS.space.lg }}>
        <View style={styles.sectionTitleRow}>
          <View style={[styles.cardIcon, { backgroundColor: `${DS.primary}15` }]}>
            <Ionicons name="trophy" size={14} color={DS.primary} />
          </View>
          <Text style={[styles.sectionTitleText, { color: isDark ? DS.white : DS.gray900 }]}>Achievements</Text>
          <View style={[styles.cardPill, { backgroundColor: `${DS.primary}15`, marginLeft: 'auto' }]}>
            <Text style={[styles.cardPillText, { color: DS.primary }]}>{achievements.length} earned</Text>
          </View>
        </View>
        <GlassCard isDark={isDark}>
          <View style={{ padding: DS.space.md, gap: 8 }}>
            {achievements.length > 0 ? (
              achievements.map((achievement) => {
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
                <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>This parent is just getting started!</Text>
              </View>
            )}
          </View>
        </GlassCard>

        {achievements.length > 0 && (
          <GlassCard isDark={isDark} delay={80}>
            <View style={{ padding: DS.space.md, gap: 10 }}>
              <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900 }]}>Progress</Text>
              {[
                { label: 'Posts', value: userPostList.length, max: 50, color: DS.primary },
                { label: 'Helpful', value: user?.stats?.helpful || 0, max: 50, color: DS.success },
              ].map((p) => (
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
        )}
      </Animated.View>
    );
  };

  const renderInsightsTab = () => (
    <Animated.View entering={FadeInUp.springify()} style={{ gap: 10, paddingHorizontal: DS.space.lg }}>
      <GlassCard isDark={isDark}>
        <View style={{ padding: DS.space.md }}>
          <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900, marginBottom: DS.space.md }]}>Topic Breakdown</Text>
          {topicBreakdown.length === 0 ? (
            <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>No topics yet</Text>
          ) : (
            topicBreakdown.map((t) => (
              <View key={t.topicId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <View style={[styles.breakdownIcon, { backgroundColor: `${t.color}15` }]}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.color }} />
                </View>
                <Text style={[styles.barLabel, { color: isDark ? DS.gray300 : DS.gray600, flex: 1 }]} numberOfLines={1}>{t.label}</Text>
                <View style={[styles.barBg, { flex: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                  <View style={[styles.barFill, { width: `${t.percentage}%`, backgroundColor: t.color }]} />
                </View>
                <Text style={[styles.barValue, { color: t.color, width: 24, textAlign: 'right' }]}>{t.count}</Text>
              </View>
            ))
          )}
        </View>
      </GlassCard>

      <GlassCard isDark={isDark} delay={60}>
        <View style={{ padding: DS.space.md }}>
          <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900, marginBottom: DS.space.md }]}>Contribution Streak</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {contributionStreak.weeks.map((active, i) => (
              <View key={i} style={[styles.streakCell, {
                backgroundColor: active ? DS.primary : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
              }]} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: DS.space.md }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.streakValue, { color: DS.primary }]}>{contributionStreak.current}</Text>
              <Text style={[styles.streakLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>Current</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.streakValue, { color: DS.accent }]}>{contributionStreak.longest}</Text>
              <Text style={[styles.streakLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>Best</Text>
            </View>
          </View>
        </View>
      </GlassCard>

      <GlassCard isDark={isDark} delay={120}>
        <View style={{ padding: DS.space.md }}>
          <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900, marginBottom: DS.space.md }]}>Highlights</Text>
          <View style={{ flexDirection: 'row' }}>
            {[
              { label: 'Most Liked', value: contentHighlights.mostLiked, color: DS.accent },
              { label: 'Most Comments', value: contentHighlights.mostCommented, color: DS.primary },
              { label: 'Engagement', value: `${contentHighlights.avgEngagement}%`, color: DS.success },
            ].map((m, i) => (
              <React.Fragment key={m.label}>
                <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                  <Text style={[styles.insightValue, { color: m.color }]}>{m.value}</Text>
                  <Text style={[styles.insightLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>{m.label}</Text>
                </View>
                {i < 2 && <View style={[styles.insightDivider, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />}
              </React.Fragment>
            ))}
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );

  /* Guards */
  if (!user && !isHydrating) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50, alignItems: 'center', justifyContent: 'center' }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <Ionicons name="person-outline" size={64} color={DS.gray400} />
        <Text style={{ marginTop: 16, color: isDark ? DS.gray400 : DS.gray500, fontSize: 16, fontWeight: '600' }}>User not found</Text>
        <PressableScale onPress={() => navigation.goBack()} activeScale={0.96}>
          <LinearGradient colors={[DS.primary, DS.accent]} style={{ marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: DS.white }}>Go Back</Text>
          </LinearGradient>
        </PressableScale>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <LinearGradient
        colors={isDark ? [DS.darkBg, '#12121e', DS.darkBg] : ['#f8faff', '#eef0f5', '#e4e8f0']}
        style={StyleSheet.absoluteFill}
      />

      {/* Sticky header — pointerEvents none for the scrolled title */}
      <Animated.View
        style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}
        pointerEvents="none"
      >
        <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Text style={[styles.stickyTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
          {user?.displayName || 'Member'}
        </Text>
        <Text style={[styles.stickySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>{user?.handle || ''}</Text>
      </Animated.View>

      {/* Back button (fixed) */}
      <Animated.View entering={FadeInDown.springify()} style={[styles.topHeader, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
        <PressableScale onPress={() => navigation.goBack()} activeScale={0.92}>
          <View style={[styles.backBtn, {
            backgroundColor: isDark ? 'rgba(15,15,30,0.55)' : 'rgba(255,255,255,0.85)',
            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)',
          }]}>
            <Ionicons name="arrow-back" size={22} color={isDark ? DS.white : DS.gray800} />
          </View>
        </PressableScale>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 68, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DS.primary} colors={[DS.primary, DS.accent]} />
        }
      >
        {/* Identity Capsule */}
        <View style={{ paddingHorizontal: DS.space.lg }}>
          {isHydrating && !user ? (
            <CapsuleSkeleton isDark={isDark} avatarSize={avatarSize} />
          ) : (
            <IdentityCapsule
              isDark={isDark}
              user={user}
              avatarSize={avatarSize}
              isFollowingUser={isFollowingUser}
              isBlocked={isBlocked}
              isOwnProfile={isOwnProfile}
              followerCount={followerCount}
              followingCount={followingCount}
              postCount={userPostList.length}
              onAvatarPress={() => setShowAvatarPreview(true)}
              onFollowToggle={handleFollowToggle}
              onMessage={handleMessage}
              onShare={handleShareProfile}
              onMore={handleMoreOptions}
            />
          )}
        </View>

        {/* Bio ribbon */}
        {user && (user.bio || user.country) && (
          <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
            <BioRibbon isDark={isDark} user={user} onPress={() => setActiveTab('about')} />
          </View>
        )}

        {/* Insight ribbon */}
        {user && (
          <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
            <InsightRibbon
              isDark={isDark}
              icon={communityInfluence.percentile > 50 ? 'trophy-outline' : 'sparkles-outline'}
              color={communityInfluence.percentile > 50 ? '#8b5cf6' : DS.primary}
              label={communityInfluence.rank}
              text={`Top ${communityInfluence.percentile}% of ${allUsers.length} parents · ${userPostList.length} posts`}
              onPress={() => handleTabChange('insights')}
            />
          </View>
        )}

        {/* Tab bar */}
        <View style={{ marginTop: DS.space.md }}>
          <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} isDark={isDark} />
        </View>

        {/* Tab content */}
        <View style={{ marginTop: DS.space.md }}>
          {activeTab === 'posts' && renderPostsTab()}
          {activeTab === 'about' && renderAboutTab()}
          {activeTab === 'achievements' && renderAchievementsTab()}
          {activeTab === 'insights' && renderInsightsTab()}
        </View>
      </Animated.ScrollView>

      {/* Avatar preview modal */}
      <Modal
        visible={showAvatarPreview && !!user}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAvatarPreview(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.avatarPreviewOverlay} onPress={() => setShowAvatarPreview(false)}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <Animated.View entering={FadeInUp.springify()} style={styles.avatarPreviewCard}>
            {user?.avatar && !isEmojiAvatar(user.avatar) ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarPreviewImg} resizeMode="cover" />
            ) : (
              <LinearGradient colors={[DS.primary, DS.accent]} style={styles.avatarPreviewImg}>
                <Text style={{ fontSize: 96, textAlign: 'center', lineHeight: 240 }}>
                  {isEmojiAvatar(user?.avatar) ? user?.avatar : user?.displayName?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </LinearGradient>
            )}
            <Text style={styles.avatarPreviewName}>{user?.displayName}</Text>
            <Text style={styles.avatarPreviewHandle}>{user?.handle}</Text>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Sticky header */
  stickyHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10,
  },
  stickyTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  stickySub: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  /* Top header */
  topHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: DS.space.lg,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 6,
  },

  /* Identity capsule */
  capsule: {
    borderRadius: DS.radius['2xl'], padding: DS.space.lg, overflow: 'hidden',
    borderWidth: 1, ...DS.shadow.md,
  },
  capsuleGlowL: { position: 'absolute', top: -80, left: -60, width: 220, height: 220, borderRadius: 110, opacity: 0.9 },
  capsuleGlowR: { position: 'absolute', top: -70, right: -70, width: 200, height: 200, borderRadius: 100, opacity: 0.8 },
  capsuleRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md },
  avatarWrap: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  avatarGlow: { position: 'absolute', width: 92, height: 92, borderRadius: 46, backgroundColor: `${DS.primary}35` },
  avatarRing: { position: 'absolute', width: 88, height: 88, borderRadius: 44, overflow: 'hidden' },
  avatarInner: { width: 80, height: 80, borderRadius: 40, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  onlineBadge: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  capsuleName: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3, maxWidth: '70%' },
  verifiedDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: DS.primary, alignItems: 'center', justifyContent: 'center' },
  capsuleHandle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  capsuleStats: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  capsuleStatItem: { alignItems: 'center' },
  capsuleStatValue: { fontSize: 14, fontWeight: '800' },
  capsuleStatLabel: { fontSize: 9, fontWeight: '600', marginTop: 1 },
  capsuleStatDiv: { width: 1, height: 18 },
  capsuleActions: { flexDirection: 'row', gap: 8, marginTop: DS.space.md, alignItems: 'center' },
  actionPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 14,
  },
  actionPrimaryText: { fontSize: 13, fontWeight: '700' },
  actionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  /* Bio ribbon */
  bioRibbon: {
    flexDirection: 'row', alignItems: 'flex-start', gap: DS.space.md,
    paddingVertical: DS.space.md, paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm,
  },
  bioIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  bioText: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  bioLocation: { fontSize: 11, fontWeight: '500' },

  /* Insight ribbon */
  ribbon: {
    flexDirection: 'row', alignItems: 'center', gap: DS.space.md,
    paddingVertical: DS.space.md, paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm,
  },
  ribbonIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ribbonText: { fontSize: 12, fontWeight: '600', marginTop: 1, lineHeight: 16 },

  /* Tab bar */
  tabBar: {
    flexDirection: 'row', marginHorizontal: DS.space.lg,
    padding: 4, borderRadius: DS.radius.full, gap: 2,
  },
  tabItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 9, borderRadius: DS.radius.full,
  },
  tabLabel: { fontSize: 11, fontWeight: '600' },

  /* Glass card */
  glassCard: {
    borderRadius: DS.radius.lg, overflow: 'hidden', borderWidth: 1, ...DS.shadow.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm },
  cardIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  cardSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  cardPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  cardPillText: { fontSize: 11, fontWeight: '800' },

  /* Insights row */
  insightValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  insightLabel: { fontSize: 10, fontWeight: '600' },
  insightDivider: { width: 1, height: 30 },

  /* Bars */
  barLabel: { fontSize: 11, fontWeight: '600' },
  barValue: { fontSize: 11, fontWeight: '700' },
  barBg: { height: 5, borderRadius: 3, overflow: 'hidden', flex: 1 },
  barFill: { height: '100%', borderRadius: 3 },

  /* Rank */
  rankBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  rankBadgeText: { fontSize: 12, fontWeight: '800' },

  /* Top post */
  topPostContent: { fontSize: 13, fontWeight: '600', lineHeight: 19 },
  topPostStats: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  postStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postStatText: { fontSize: 12, fontWeight: '600' },

  /* Breakdown */
  breakdownIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  breakdownValue: { fontSize: 16, fontWeight: '800' },
  breakdownLabel: { fontSize: 10, fontWeight: '600' },

  /* Live pill */
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  liveDot: { width: 5, height: 5, borderRadius: 3 },
  liveText: { fontSize: 9, fontWeight: '800' },

  /* Activity bars */
  activityBar: { width: '80%', borderRadius: 4 },
  activityLabel: { fontSize: 10, fontWeight: '600' },

  /* Section title */
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, marginBottom: DS.space.md },
  sectionTitleText: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },

  /* Post card */
  postCard: {
    borderRadius: DS.radius.lg, padding: DS.space.md, borderWidth: 1, ...DS.shadow.sm,
  },
  topicPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, maxWidth: '70%',
  },
  topicPillText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  postTime: { fontSize: 10, fontWeight: '500' },
  postContent: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  postImgWrap: { marginTop: DS.space.sm, borderRadius: 10, overflow: 'hidden', height: 140 },
  postImg: { width: '100%', height: '100%' },
  postStats: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: DS.space.sm },

  /* Empty */
  emptyCard: {
    alignItems: 'center', paddingVertical: DS.space['2xl'],
    paddingHorizontal: DS.space.lg, borderRadius: DS.radius.lg,
    borderWidth: 1, gap: 8, ...DS.shadow.sm,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  emptySub: { fontSize: 12, fontWeight: '500', textAlign: 'center', lineHeight: 17 },

  /* Achievement */
  achievementRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12 },
  achievementIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  achievementName: { fontSize: 13, fontWeight: '700' },
  achievementDesc: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  /* Topics */
  topicChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, maxWidth: '100%' },
  topicChipText: { fontSize: 12, fontWeight: '700' },

  /* Info */
  infoValue: { fontSize: 14, fontWeight: '700' },

  /* Streak */
  streakCell: { width: 22, height: 22, borderRadius: 6 },
  streakValue: { fontSize: 22, fontWeight: '800' },
  streakLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },

  /* Avatar preview */
  avatarPreviewOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  avatarPreviewCard: {
    alignItems: 'center', padding: 24, borderRadius: 28,
    backgroundColor: 'rgba(15,15,30,0.75)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)', maxWidth: 400,
  },
  avatarPreviewImg: {
    width: 240, height: 240, borderRadius: 120, borderWidth: 4, borderColor: DS.white,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 16,
  },
  avatarPreviewName: { fontSize: 22, fontWeight: '800', color: DS.white, letterSpacing: -0.5 },
  avatarPreviewHandle: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.7)', marginTop: 4 },
});