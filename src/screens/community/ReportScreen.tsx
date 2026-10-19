import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity } from '../../context/CommunityContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { SafeAvatar } from '../../components/SafeAvatar';
import { supabase } from '../../services/supabaseClient';

type ReportScreenProps = NativeStackScreenProps<CommunityStackParamList, 'Report'>;

/* ── The Loom palette ─────────────────────────────────────── */
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
  purple: '#8b5cf6',
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
  lightBg: '#fafaf9',
  lightBorder: '#e7e5e4',
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
};

type ReportType = 'user' | 'post' | 'comment' | 'topic';

interface ReasonOption {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  severity: 'low' | 'medium' | 'high';
  types: ReportType[]; // which report types this reason applies to
}

/* ── Reason catalogue ─────────────────────────────────────── */
const ALL_REASONS: ReasonOption[] = [
  {
    id: 'harassment',
    label: 'Harassment or bullying',
    description: 'Targeted attacks, threats, or intimidation',
    icon: 'alert-circle',
    color: DS.danger,
    severity: 'high',
    types: ['user', 'post', 'comment', 'topic'],
  },
  {
    id: 'hate_speech',
    label: 'Hate speech',
    description: 'Attacks based on identity or beliefs',
    icon: 'megaphone',
    color: DS.danger,
    severity: 'high',
    types: ['user', 'post', 'comment'],
  },
  {
    id: 'spam',
    label: 'Spam or scam',
    description: 'Repeated unwanted content or fraud',
    icon: 'mail-unread',
    color: DS.warning,
    severity: 'medium',
    types: ['user', 'post', 'comment', 'topic'],
  },
  {
    id: 'misinformation',
    label: 'Medical misinformation',
    description: 'Unverified or dangerous health claims',
    icon: 'medkit',
    color: DS.warning,
    severity: 'high',
    types: ['post', 'comment', 'topic'],
  },
  {
    id: 'inappropriate',
    label: 'Inappropriate content',
    description: 'Nudity, graphic violence, or adult content',
    icon: 'eye-off',
    color: DS.danger,
    severity: 'high',
    types: ['user', 'post', 'comment'],
  },
  {
    id: 'self_harm',
    label: 'Self-harm or suicide',
    description: 'Content that could harm the poster or others',
    icon: 'warning',
    color: DS.danger,
    severity: 'high',
    types: ['user', 'post', 'comment'],
  },
  {
    id: 'impersonation',
    label: 'Impersonation',
    description: 'Pretending to be someone else',
    icon: 'person-remove',
    color: DS.purple,
    severity: 'medium',
    types: ['user'],
  },
  {
    id: 'off_topic',
    label: 'Off-topic or irrelevant',
    description: 'Not relevant to the topic or community',
    icon: 'compass-outline',
    color: DS.info,
    severity: 'low',
    types: ['post', 'comment', 'topic'],
  },
  {
    id: 'copyright',
    label: 'Copyright violation',
    description: 'Unauthorized use of someone else\'s work',
    icon: 'document-lock',
    color: DS.info,
    severity: 'medium',
    types: ['post', 'comment'],
  },
  {
    id: 'other',
    label: 'Something else',
    description: 'Describe the issue in your own words',
    icon: 'ellipsis-horizontal',
    color: DS.gray500,
    severity: 'low',
    types: ['user', 'post', 'comment', 'topic'],
  },
];

/* ── Type metadata ────────────────────────────────────────── */
const TYPE_META: Record<ReportType, { label: string; icon: string; hint: string }> = {
  user: { label: 'Report User', icon: 'person', hint: 'Let us know what happened with this parent.' },
  post: { label: 'Report Post', icon: 'document-text', hint: 'Help us keep The Loom safe for everyone.' },
  comment: { label: 'Report Comment', icon: 'chatbubble', hint: 'Report the comment that concerns you.' },
  topic: { label: 'Report Topic', icon: 'pricetag', hint: 'Let us know what\'s wrong with this topic.' },
};

const MAX_DETAILS = 500;

/* ═══════════════════════════════════════════════════════════
   Main
   ═══════════════════════════════════════════════════════════ */
export default function ReportScreen({ navigation, route }: ReportScreenProps) {
  const params = (route.params ?? {}) as {
    type: ReportType;
    targetId: string;
    targetUserId?: string;
    postId?: string;
  };

  const reportType: ReportType = params.type ?? 'post';
  const targetId = params.targetId ?? '';
  const targetUserId = params.targetUserId ?? '';
  const postId = params.postId ?? '';

  const { getUserById, getPostById, blockUser, isUserBlocked, currentUser } = useCommunity();
  const { darkMode, triggerHaptic } = useCustomization();
  const isDark = darkMode ?? false;
  const insets = useSafeAreaInsets();
  const sweetAlert = useSweetAlert();

  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [blockAfterReport, setBlockAfterReport] = useState(reportType === 'user');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const meta = TYPE_META[reportType];

  /* ── Resolve the target for preview ─────────────────────── */
  const targetPreview = useMemo(() => {
    try {
      if (reportType === 'user') {
        const u = getUserById(targetUserId || targetId);
        return u
          ? { kind: 'user' as const, displayName: u.displayName, handle: u.handle, avatar: u.avatar, bio: u.bio }
          : null;
      }
      if (reportType === 'post') {
        const p = getPostById(targetId) || (postId ? getPostById(postId) : undefined);
        return p
          ? {
              kind: 'post' as const,
              displayName: p.author?.displayName || 'Post',
              handle: p.author?.handle || '',
              avatar: p.author?.avatar || '',
              bio: p.content?.substring(0, 140) || '',
            }
          : null;
      }
      if (reportType === 'comment') {
        const p = postId ? getPostById(postId) : undefined;
        return p
          ? {
              kind: 'comment' as const,
              displayName: p.author?.displayName || 'Comment',
              handle: p.author?.handle || '',
              avatar: p.author?.avatar || '',
              bio: 'Comment on a thread',
            }
          : null;
      }
      if (reportType === 'topic') {
        return {
          kind: 'topic' as const,
          displayName: targetId,
          handle: '',
          avatar: '📌',
          bio: 'Community topic',
        };
      }
      return null;
    } catch {
      return null;
    }
  }, [reportType, targetId, targetUserId, postId, getUserById, getPostById]);

  /* ── Failsafe for user reports with block ───────────────── */
  const alreadyBlocked = useMemo(
    () => (targetUserId ? isUserBlocked(targetUserId) : false),
    [targetUserId, isUserBlocked],
  );

  /* ── Reasons filtered by type ──────────────────────────── */
  const reasonsForType = useMemo(
    () => ALL_REASONS.filter((r) => r.types.includes(reportType)),
    [reportType],
  );

  /* ── Submit ──────────────────────────────────────────────── */
  const handleSubmit = useCallback(async () => {
    if (!selectedReason) {
      triggerHaptic?.('error');
      sweetAlert.alert('Pick a Reason', 'Please choose at least one reason for your report.', 'info');
      return;
    }

    setIsSubmitting(true);
    triggerHaptic?.('medium');

    try {
      const reason = ALL_REASONS.find((r) => r.id === selectedReason);

      // 1) Best-effort persistence (non-fatal if the table is missing)
      try {
        await supabase.from('community_reports').insert({
          reporter_id: currentUser?.id ?? null,
          target_type: reportType,
          target_id: targetId,
          target_user_id: targetUserId || null,
          post_id: postId || null,
          reason_id: selectedReason,
          reason_label: reason?.label ?? selectedReason,
          reason_severity: reason?.severity ?? 'low',
          details: details.trim() || null,
          blocked: blockAfterReport,
          created_at: new Date().toISOString(),
          status: 'pending',
        });
      } catch (err) {
        if (__DEV__) console.warn('[Report] persistence failed (non-fatal):', err);
      }

      // 2) Block if requested
      if (blockAfterReport && targetUserId && !alreadyBlocked) {
        try {
          await blockUser(targetUserId);
        } catch (err) {
          if (__DEV__) console.warn('[Report] block failed:', err);
        }
      }

      // 3) Success feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      triggerHaptic?.('success');
      setIsSubmitted(true);
    } catch (err) {
      console.error('[Report] submit failed:', err);
      triggerHaptic?.('error');
      sweetAlert.error('Report Failed', 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    selectedReason,
    reportType,
    targetId,
    targetUserId,
    postId,
    details,
    blockAfterReport,
    alreadyBlocked,
    currentUser?.id,
    blockUser,
    sweetAlert,
    triggerHaptic,
  ]);

  const handleBack = useCallback(() => {
    if (isSubmitting) return;
    if (navigation.canGoBack()) navigation.goBack();
  }, [isSubmitting, navigation]);

  const handleDone = useCallback(() => {
    triggerHaptic?.('light');
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation, triggerHaptic]);

  /* ── Theme tokens ───────────────────────────────────────── */
  const cardBg = isDark ? DS.darkCard : DS.white;
  const cardBorder = isDark ? DS.darkBorder : DS.lightBorder;
  const textPrimary = isDark ? DS.white : DS.gray900;
  const textSecondary = isDark ? DS.gray400 : DS.gray500;
  const inputBg = isDark ? 'rgba(255,255,255,0.05)' : DS.gray50;

  /* ── Success screen ─────────────────────────────────────── */
  if (isSubmitted) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.lightBg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <LinearGradient
          colors={
            isDark
              ? ['rgba(16,185,129,0.15)', 'rgba(99,102,241,0.08)', 'transparent']
              : ['rgba(16,185,129,0.10)', 'rgba(99,102,241,0.04)', 'transparent']
          }
          style={StyleSheet.absoluteFill}
        />

        <View
          style={[
            styles.successWrap,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 },
          ]}
        >
          <Animated.View entering={ZoomIn.springify().damping(14)}>
            <LinearGradient
              colors={[DS.success, '#34d399']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.successIcon}
            >
              <Ionicons name="checkmark" size={54} color={DS.white} />
            </LinearGradient>
          </Animated.View>

          <Animated.Text
            entering={FadeInUp.delay(150).duration(400)}
            style={[styles.successTitle, { color: textPrimary }]}
          >
            We're on it
          </Animated.Text>
          <Animated.Text
            entering={FadeInUp.delay(250).duration(400)}
            style={[styles.successDesc, { color: textSecondary }]}
          >
            Thanks for keeping The Loom safe. Our team reviews every report — usually within 24 hours.
            {blockAfterReport && targetUserId && !alreadyBlocked ? ' The user is now blocked.' : ''}
          </Animated.Text>

          <Animated.View entering={FadeInUp.delay(350).duration(400)} style={styles.successMeta}>
            <View
              style={[
                styles.successMetaRow,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray100 },
              ]}
            >
              <Ionicons name="time-outline" size={14} color={DS.primary} />
              <Text style={[styles.successMetaText, { color: isDark ? DS.gray300 : DS.gray700 }]}>
                Typical review time: under 24 hours
              </Text>
            </View>
            <View
              style={[
                styles.successMetaRow,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray100 },
              ]}
            >
              <Ionicons name="lock-closed-outline" size={14} color={DS.primary} />
              <Text style={[styles.successMetaText, { color: isDark ? DS.gray300 : DS.gray700 }]}>
                Your report is completely confidential
              </Text>
            </View>
          </Animated.View>

          <TouchableOpacity
            onPress={handleDone}
            activeOpacity={0.88}
            style={styles.successBtn}
          >
            <LinearGradient
              colors={[DS.primary, DS.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.successBtnGrad}
            >
              <Text style={styles.successBtnText}>Back to Community</Text>
              <Ionicons name="arrow-forward" size={16} color={DS.white} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /* ── Main render ─────────────────────────────────────────── */
  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.lightBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      <LinearGradient
        colors={
          isDark
            ? ['rgba(239,68,68,0.10)', 'rgba(99,102,241,0.05)', 'transparent']
            : ['rgba(239,68,68,0.05)', 'rgba(99,102,241,0.02)', 'transparent']
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />

      {/* Header */}
      <Animated.View
        entering={FadeInDown.springify()}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity
          onPress={handleBack}
          style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.white }]}
          disabled={isSubmitting}
        >
          <Ionicons name="arrow-back" size={20} color={textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>{meta.label}</Text>
        <View style={styles.headerBtn} />
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Intro */}
          <Animated.View entering={FadeInUp.delay(40).duration(400)}>
            <Text style={[styles.introTitle, { color: textPrimary }]}>
              What's happening?
            </Text>
            <Text style={[styles.introDesc, { color: textSecondary }]}>
              {meta.hint} Reports are anonymous — the reported person won't know it was you.
            </Text>
          </Animated.View>

          {/* Target preview */}
          {targetPreview && (
            <Animated.View entering={FadeInUp.delay(80).duration(400)}>
              <View style={[styles.previewCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <LinearGradient
                  colors={
                    isDark
                      ? [`${DS.primary}12`, `${DS.accent}06`]
                      : [`${DS.primary}08`, `${DS.accent}03`]
                  }
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  pointerEvents="none"
                />
                <View style={styles.previewRow}>
                  <SafeAvatar
                    avatar={targetPreview.avatar}
                    size={48}
                    fallbackIcon={reportType === 'topic' ? 'pricetag' : 'person'}
                    fallbackColor={DS.primary}
                    fallbackBgColor={`${DS.primary}20`}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      style={[styles.previewName, { color: textPrimary }]}
                      numberOfLines={1}
                    >
                      {targetPreview.displayName}
                    </Text>
                    {targetPreview.handle ? (
                      <Text
                        style={[styles.previewHandle, { color: textSecondary }]}
                        numberOfLines={1}
                      >
                        {targetPreview.handle}
                      </Text>
                    ) : null}
                    {targetPreview.bio ? (
                      <Text
                        style={[styles.previewBio, { color: isDark ? DS.gray400 : DS.gray600 }]}
                        numberOfLines={2}
                      >
                        {targetPreview.bio}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Reasons list */}
          <Animated.View entering={FadeInUp.delay(120).duration(400)}>
            <Text style={[styles.sectionLabel, { color: textSecondary }]}>REASON</Text>
            <View style={styles.reasonList}>
              {reasonsForType.map((reason, idx) => {
                const selected = selectedReason === reason.id;
                return (
                  <Animated.View
                    key={reason.id}
                    entering={FadeInUp.delay(150 + idx * 20).duration(300)}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        triggerHaptic?.('light');
                        setSelectedReason(reason.id);
                      }}
                      activeOpacity={0.8}
                      style={[
                        styles.reasonCard,
                        {
                          backgroundColor: cardBg,
                          borderColor: selected ? reason.color : cardBorder,
                          borderWidth: selected ? 2 : 1,
                        },
                      ]}
                    >
                      {selected && (
                        <LinearGradient
                          colors={[`${reason.color}22`, `${reason.color}06`]}
                          style={StyleSheet.absoluteFill}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          pointerEvents="none"
                        />
                      )}
                      <View
                        style={[
                          styles.reasonIconWrap,
                          {
                            backgroundColor: `${reason.color}18`,
                          },
                        ]}
                      >
                        <Ionicons name={reason.icon as any} size={18} color={reason.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.reasonHeaderRow}>
                          <Text
                            style={[
                              styles.reasonLabel,
                              { color: selected ? reason.color : textPrimary },
                            ]}
                            numberOfLines={1}
                          >
                            {reason.label}
                          </Text>
                          {reason.severity === 'high' && (
                            <View
                              style={[
                                styles.severityPill,
                                { backgroundColor: `${DS.danger}18` },
                              ]}
                            >
                              <Text style={[styles.severityText, { color: DS.danger }]}>
                                High
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text
                          style={[
                            styles.reasonDesc,
                            { color: isDark ? DS.gray400 : DS.gray600 },
                          ]}
                          numberOfLines={2}
                        >
                          {reason.description}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.radio,
                          {
                            borderColor: selected ? reason.color : isDark ? DS.gray600 : DS.gray300,
                            backgroundColor: selected ? reason.color : 'transparent',
                          },
                        ]}
                      >
                        {selected && <Ionicons name="checkmark" size={12} color={DS.white} />}
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>

          {/* Details */}
          <Animated.View entering={FadeInUp.delay(240).duration(400)}>
            <View style={styles.detailsHeaderRow}>
              <Text style={[styles.sectionLabel, { color: textSecondary }]}>
                DETAILS <Text style={{ color: DS.gray400 }}>(OPTIONAL)</Text>
              </Text>
              <Text
                style={[
                  styles.charCount,
                  {
                    color:
                      details.length > MAX_DETAILS * 0.9
                        ? DS.warning
                        : isDark
                        ? DS.gray500
                        : DS.gray400,
                  },
                ]}
              >
                {details.length}/{MAX_DETAILS}
              </Text>
            </View>
            <View
              style={[
                styles.detailsWrap,
                {
                  backgroundColor: inputBg,
                  borderColor: isDark ? DS.darkBorder : DS.lightBorder,
                },
              ]}
            >
              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder="Add anything else our team should know..."
                placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
                style={[styles.detailsInput, { color: textPrimary }]}
                multiline
                textAlignVertical="top"
                maxLength={MAX_DETAILS}
              />
            </View>
          </Animated.View>

          {/* Block toggle */}
          {targetUserId && !alreadyBlocked && (
            <Animated.View entering={FadeInUp.delay(280).duration(400)}>
              <TouchableOpacity
                onPress={() => {
                  triggerHaptic?.('light');
                  setBlockAfterReport((v) => !v);
                }}
                activeOpacity={0.85}
                style={[
                  styles.blockRow,
                  { backgroundColor: cardBg, borderColor: cardBorder },
                ]}
              >
                <View
                  style={[
                    styles.blockIcon,
                    { backgroundColor: `${DS.danger}18` },
                  ]}
                >
                  <Ionicons name="ban" size={18} color={DS.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.blockLabel, { color: textPrimary }]}>
                    Also block this user
                  </Text>
                  <Text style={[styles.blockDesc, { color: textSecondary }]}>
                    They won't be able to message or follow you
                  </Text>
                </View>
                <View
                  style={[
                    styles.switchTrack,
                    {
                      backgroundColor: blockAfterReport
                        ? DS.danger
                        : isDark
                        ? 'rgba(255,255,255,0.10)'
                        : DS.gray200,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.switchThumb,
                      {
                        transform: [{ translateX: blockAfterReport ? 18 : 2 }],
                        backgroundColor: DS.white,
                      },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}

          {alreadyBlocked && (
            <Animated.View entering={FadeIn.duration(300)}>
              <View
                style={[
                  styles.blockedNotice,
                  {
                    backgroundColor: `${DS.success}12`,
                    borderColor: `${DS.success}30`,
                  },
                ]}
              >
                <Ionicons name="checkmark-circle" size={16} color={DS.success} />
                <Text style={[styles.blockedNoticeText, { color: DS.success }]}>
                  You've already blocked this user
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Policy note */}
          <Animated.View entering={FadeInUp.delay(320).duration(400)}>
            <View
              style={[
                styles.policyNote,
                { backgroundColor: `${DS.info}10`, borderColor: `${DS.info}25` },
              ]}
            >
              <Ionicons name="shield-checkmark-outline" size={16} color={DS.info} />
              <Text style={[styles.policyText, { color: isDark ? DS.gray300 : DS.gray700 }]}>
                Repeated false reports may affect your account. Only report content that
                genuinely violates our{' '}
                <Text style={{ color: DS.info, fontWeight: '800' }}>Community Guidelines</Text>.
              </Text>
            </View>
          </Animated.View>

          {/* Submit */}
          <Animated.View entering={FadeInUp.delay(360).duration(400)} style={{ marginTop: 20 }}>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!selectedReason || isSubmitting}
              activeOpacity={0.88}
              style={[
                styles.submitBtn,
                (!selectedReason || isSubmitting) && { opacity: 0.6 },
              ]}
            >
              {selectedReason ? (
                <LinearGradient
                  colors={[DS.danger, DS.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <LinearGradient
                  colors={
                    isDark ? ['#334155', '#475569'] : [DS.gray300, DS.gray400]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              {isSubmitting ? (
                <ActivityIndicator size="small" color={DS.white} />
              ) : (
                <>
                  <Ionicons name="flag" size={18} color={DS.white} />
                  <Text style={styles.submitBtnText}>Submit Report</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={[styles.submitHint, { color: textSecondary }]}>
              Your report is confidential. The reported person won't know it was you.
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════
   Styles
   ═══════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.lg,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },

  scrollContent: { paddingHorizontal: DS.space.lg, paddingTop: 8 },

  /* Intro */
  introTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  introDesc: { fontSize: 13, fontWeight: '500', lineHeight: 19, marginBottom: 16 },

  /* Target preview */
  previewCard: {
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center' },
  previewName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2, marginBottom: 2 },
  previewHandle: { fontSize: 12, fontWeight: '500', marginBottom: 4 },
  previewBio: { fontSize: 12, fontWeight: '500', lineHeight: 17 },

  /* Section label */
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  /* Reasons */
  reasonList: { gap: 10, marginBottom: 20 },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: DS.radius.lg,
    gap: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  reasonIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  reasonLabel: { fontSize: 13.5, fontWeight: '700', flexShrink: 1 },
  reasonDesc: { fontSize: 11.5, fontWeight: '500', lineHeight: 16 },
  severityPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  severityText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Details */
  detailsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  charCount: { fontSize: 11, fontWeight: '600' },
  detailsWrap: {
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    padding: 12,
    minHeight: 120,
    marginBottom: 20,
  },
  detailsInput: {
    fontSize: 13.5,
    fontWeight: '500',
    lineHeight: 20,
    minHeight: 96,
    paddingTop: 0,
  },

  /* Block toggle */
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    marginBottom: 14,
  },
  blockIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockLabel: { fontSize: 13.5, fontWeight: '700', marginBottom: 2 },
  blockDesc: { fontSize: 11, fontWeight: '500' },
  switchTrack: {
    width: 40,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  blockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  blockedNoticeText: { fontSize: 12, fontWeight: '700' },

  /* Policy note */
  policyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  policyText: { flex: 1, fontSize: 11.5, fontWeight: '500', lineHeight: 17 },

  /* Submit */
  submitBtn: {
    height: 54,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 5,
  },
  submitBtnText: { fontSize: 15, fontWeight: '800', color: DS.white, letterSpacing: 0.2 },
  submitHint: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 16,
  },

  /* Success */
  successWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: DS.space['2xl'],
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: DS.success,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 10,
    textAlign: 'center',
  },
  successDesc: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  successMeta: { alignSelf: 'stretch', gap: 8, marginBottom: 28 },
  successMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  successMetaText: { flex: 1, fontSize: 12, fontWeight: '600' },
  successBtn: {
    alignSelf: 'stretch',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 5,
  },
  successBtnGrad: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  successBtnText: { fontSize: 15, fontWeight: '800', color: DS.white, letterSpacing: 0.2 },
});