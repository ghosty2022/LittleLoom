import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
  StatusBar,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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
  gray100: '#f5f5f4',
  gray200: '#e7e5e4',
  gray300: '#d6d3d1',
  gray400: '#a8a29e',
  gray500: '#78716c',
  gray600: '#57534e',
  gray800: '#292524',
  gray900: '#1c1917',
  darkCard: '#292524',
  darkSurface: '#1c1917',
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  shadow: {
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 12 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.18, shadowRadius: 48, elevation: 24 },
  },
};

/* ── Unified motion constants (identical feel across toast/modal/sheet) ── */
const MOTION = {
  spring: { damping: 18, stiffness: 220, mass: 0.9 },
  enterDuration: 260,
  exitDuration: 200,
  overlayIn: 200,
  overlayOut: 180,
  easingIn: Easing.out(Easing.cubic),
  easingOut: Easing.in(Easing.cubic),
};

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */
export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'question' | 'loading';
export type AlertStyle = 'toast' | 'modal' | 'bottom-sheet';
export type AlertPosition = 'top' | 'center' | 'bottom';
export type PromptType = 'plain-text' | 'secure-text' | 'email' | 'phone';

export interface SweetAlertConfig {
  title: string;
  message?: string;
  type?: AlertType;
  style?: AlertStyle;
  position?: AlertPosition;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  showConfirm?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  onDismiss?: () => void;
  duration?: number;
  autoDismiss?: boolean;
  confirmColor?: string;
  destructive?: boolean;
  cancelColor?: string;
  iconColor?: string;
  haptic?: boolean;
  reduceMotion?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  progress?: number;
  actionButtons?: {
    text: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    icon?: keyof typeof Ionicons.glyphMap;
  }[];
  isPrompt?: boolean;
  promptType?: PromptType;
  promptPlaceholder?: string;
  promptValue?: string;
  onPromptConfirm?: (value: string) => void;
  onPromptCancel?: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ALERT CONFIG
   ═══════════════════════════════════════════════════════════════════════════ */
const ALERT_CONFIG: Record<AlertType, {
  colors: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
  defaultColor: string;
  hapticType: Haptics.NotificationFeedbackType;
  bgTint: string;
}> = {
  success: { colors: ['#10b981', '#34d399'], icon: 'checkmark-circle', defaultColor: '#10b981', hapticType: Haptics.NotificationFeedbackType.Success, bgTint: 'rgba(16,185,129,0.10)' },
  error: { colors: ['#ef4444', '#f87171'], icon: 'close-circle', defaultColor: '#ef4444', hapticType: Haptics.NotificationFeedbackType.Error, bgTint: 'rgba(239,68,68,0.10)' },
  warning: { colors: ['#f59e0b', '#fbbf24'], icon: 'warning', defaultColor: '#f59e0b', hapticType: Haptics.NotificationFeedbackType.Warning, bgTint: 'rgba(245,158,11,0.10)' },
  info: { colors: ['#6366f1', '#818cf8'], icon: 'information-circle', defaultColor: '#6366f1', hapticType: Haptics.NotificationFeedbackType.Success, bgTint: 'rgba(99,102,241,0.10)' },
  question: { colors: ['#ec4899', '#f472b6'], icon: 'help-circle', defaultColor: '#ec4899', hapticType: Haptics.NotificationFeedbackType.Success, bgTint: 'rgba(236,72,153,0.10)' },
  loading: { colors: ['#6366f1', '#818cf8'], icon: 'sync', defaultColor: '#6366f1', hapticType: Haptics.NotificationFeedbackType.Success, bgTint: 'rgba(99,102,241,0.10)' },
};

/* ═══════════════════════════════════════════════════════════════════════════
   GLOBAL EVENT BUS
   ═══════════════════════════════════════════════════════════════════════════ */
type AlertListener = (config: SweetAlertConfig) => void;
type HideListener = () => void;

const alertListeners: Set<AlertListener> = new Set();
const hideListeners: Set<HideListener> = new Set();
const pendingQueue: SweetAlertConfig[] = [];
const MAX_QUEUE_SIZE = 50;
let providerMountCount = 0;

// ── Declared BEFORE emitHide so the closure can reference it safely ──
const dedupResetFns: Set<() => void> = new Set();

const flushQueue = () => {
  if (providerMountCount <= 0 || pendingQueue.length === 0) return;
  const queue = pendingQueue.splice(0);
  const listeners = Array.from(alertListeners);
  const owner = listeners[listeners.length - 1];
  if (!owner) return;
  queue.forEach((config) => owner(config));
};

const emitShow = (config: SweetAlertConfig) => {
  if (providerMountCount <= 0) {
    if (pendingQueue.length < MAX_QUEUE_SIZE) pendingQueue.push(config);
    return;
  }
  const listeners = Array.from(alertListeners);
  const owner = listeners[listeners.length - 1];
  if (owner) owner(config);
};

const emitHide = () => {
  pendingQueue.length = 0;
  hideListeners.forEach((listener) => listener());
  dedupResetFns.forEach((fn) => fn());
};

export const showSweetAlert = (config: SweetAlertConfig) => emitShow(config);
export const hideSweetAlert = () => emitHide();

/* ═══════════════════════════════════════════════════════════════════════════
   LOADING RING
   ═══════════════════════════════════════════════════════════════════════════ */
const LoadingRing: React.FC<{ color: string; size?: number }> = React.memo(({ color, size = 40 }) => {
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withTiming(360, { duration: 1000, easing: Easing.linear });
    const interval = setInterval(() => {
      rotation.value = 0;
      rotation.value = withTiming(360, { duration: 1000, easing: Easing.linear });
    }, 1000);
    return () => clearInterval(interval);
  }, [rotation]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  return (
    <Animated.View style={[animatedStyle, { width: size, height: size, justifyContent: 'center', alignItems: 'center' }]}>
      <View style={{ width: size, height: size, borderRadius: size / 2, borderColor: `${color}30`, borderTopColor: color, borderWidth: 3 }} />
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   PROGRESS BAR
   ═══════════════════════════════════════════════════════════════════════════ */
const ProgressBar: React.FC<{ progress: number; color: string }> = React.memo(({ progress, color }) => {
  const widthAnim = useSharedValue(0);
  useEffect(() => {
    widthAnim.value = withTiming(progress, { duration: 300, easing: Easing.out(Easing.ease) });
  }, [progress, widthAnim]);
  const animatedStyle = useAnimatedStyle(() => ({ width: `${widthAnim.value * 100}%` }));
  return (
    <View style={[styles.progressTrack, { backgroundColor: `${color}15` }]}>
      <Animated.View style={[styles.progressFill, animatedStyle, { backgroundColor: color }]} />
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════════════════════════════ */
const SweetAlertToast: React.FC<{ config: SweetAlertConfig; isDark: boolean; onDismiss: () => void }> = React.memo(({ config, isDark, onDismiss }) => {
  const type = config.type || 'info';
  const alertCfg = ALERT_CONFIG[type];
  const duration = config.duration || (type === 'error' ? 4000 : type === 'success' ? 2500 : 3000);
  const position = config.position || 'top';
  const reduceMotion = config.reduceMotion ?? false;

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(position === 'top' ? -80 : position === 'bottom' ? 80 : 30);
  const scale = useSharedValue(0.92);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissCalledRef = useRef(false);

  const dismissToast = useCallback(() => {
    if (dismissCalledRef.current) return;
    dismissCalledRef.current = true;
    if (dismissTimerRef.current) { clearTimeout(dismissTimerRef.current); dismissTimerRef.current = null; }

    if (reduceMotion) { runOnJS(onDismiss)(); return; }
    opacity.value = withTiming(0, { duration: MOTION.exitDuration, easing: MOTION.easingOut });
    translateY.value = withTiming(position === 'top' ? -60 : position === 'bottom' ? 60 : 20, { duration: MOTION.exitDuration, easing: MOTION.easingOut });
    scale.value = withTiming(0.92, { duration: MOTION.exitDuration, easing: MOTION.easingOut });
    dismissTimerRef.current = setTimeout(() => runOnJS(onDismiss)(), MOTION.exitDuration);
  }, [reduceMotion, position, onDismiss, opacity, translateY, scale]);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1; translateY.value = 0; scale.value = 1;
    } else {
      opacity.value = withTiming(1, { duration: MOTION.enterDuration, easing: MOTION.easingIn });
      translateY.value = withSpring(0, MOTION.spring);
      scale.value = withSpring(1, MOTION.spring);
    }
    if (config.autoDismiss !== false) {
      dismissTimerRef.current = setTimeout(dismissToast, duration);
    }
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [reduceMotion, duration, config.autoDismiss, dismissToast, opacity, translateY, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  const bgColor = isDark ? DS.darkCard : DS.white;
  const textColor = isDark ? DS.white : DS.gray900;
  const subTextColor = isDark ? DS.gray400 : DS.gray500;
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';

  return (
    <View style={[styles.toastWrapper, position === 'top' && styles.toastTop, position === 'center' && styles.toastCenter, position === 'bottom' && styles.toastBottom]} pointerEvents="box-none">
      <Animated.View style={[animatedStyle, styles.toastBox, { backgroundColor: bgColor, borderColor, shadowColor: alertCfg.defaultColor }]}>
        <LinearGradient colors={[`${alertCfg.defaultColor}12`, 'transparent']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        <View style={[styles.toastAccent, { backgroundColor: alertCfg.defaultColor }]} />
        <View style={[styles.toastIconWrap, { backgroundColor: alertCfg.bgTint }]}>
          <Ionicons name={config.icon || alertCfg.icon} size={20} color={alertCfg.defaultColor} />
        </View>
        <View style={{ flex: 1, paddingRight: 4 }}>
          <Text style={[styles.toastTitle, { color: textColor }]} numberOfLines={2}>{config.title}</Text>
          {config.message && <Text style={[styles.toastMessage, { color: subTextColor }]} numberOfLines={3}>{config.message}</Text>}
          {config.progress !== undefined && <ProgressBar progress={config.progress} color={alertCfg.defaultColor} />}
        </View>
        <TouchableOpacity onPress={dismissToast} style={styles.toastClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close" size={16} color={subTextColor} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   PROMPT
   ═══════════════════════════════════════════════════════════════════════════ */
const SweetAlertPrompt: React.FC<{ config: SweetAlertConfig; isDark: boolean; themeColors: { primary: string; secondary: string; accent: string }; onDismiss: () => void }> = React.memo(({ config, isDark, themeColors, onDismiss }) => {
  const [inputValue, setInputValue] = useState(config.promptValue || '');
  const [isSecure, setIsSecure] = useState(config.promptType === 'secure-text');
  const inputRef = useRef<TextInput>(null);
  const dismissCalledRef = useRef(false);

  const bgColor = isDark ? DS.darkCard : DS.white;
  const textColor = isDark ? DS.white : DS.gray900;
  const subTextColor = isDark ? DS.gray400 : DS.gray500;
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : DS.gray200;
  const inputBgColor = isDark ? 'rgba(255,255,255,0.06)' : DS.gray100;

  const overlayOpacity = useSharedValue(0);
  const modalScale = useSharedValue(0.92);
  const modalTranslateY = useSharedValue(20);

  useEffect(() => {
    overlayOpacity.value = withTiming(1, { duration: MOTION.overlayIn, easing: MOTION.easingIn });
    modalScale.value = withSpring(1, MOTION.spring);
    modalTranslateY.value = withSpring(0, MOTION.spring);
    const t = setTimeout(() => inputRef.current?.focus(), MOTION.enterDuration + 40);
    return () => clearTimeout(t);
  }, []);

  const animateOut = useCallback((callback?: () => void) => {
    overlayOpacity.value = withTiming(0, { duration: MOTION.overlayOut, easing: MOTION.easingOut });
    modalScale.value = withTiming(0.92, { duration: MOTION.exitDuration, easing: MOTION.easingOut });
    modalTranslateY.value = withTiming(20, { duration: MOTION.exitDuration, easing: MOTION.easingOut });
    setTimeout(() => callback?.(), MOTION.exitDuration);
  }, []);

  const handleConfirm = useCallback(() => {
    if (dismissCalledRef.current) return;
    dismissCalledRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    animateOut(() => { config.onPromptConfirm?.(inputValue); onDismiss(); });
  }, [config, inputValue, onDismiss, animateOut]);

  const handleCancel = useCallback(() => {
    if (dismissCalledRef.current) return;
    dismissCalledRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    animateOut(() => { config.onPromptCancel?.(); onDismiss(); });
  }, [config, onDismiss, animateOut]);

  const handleDismiss = useCallback(() => {
    if (dismissCalledRef.current) return;
    dismissCalledRef.current = true;
    animateOut(() => { config.onDismiss?.(); onDismiss(); });
  }, [config, onDismiss, animateOut]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const modalStyle = useAnimatedStyle(() => ({ transform: [{ scale: modalScale.value }, { translateY: modalTranslateY.value }] }));

  const getKeyboardType = () => config.promptType === 'email' ? 'email-address' : config.promptType === 'phone' ? 'phone-pad' : 'default';
  const getAutoCapitalize = () => config.promptType === 'email' ? 'none' : 'sentences';
  const confirmColor = config.destructive ? DS.danger : (config.confirmColor || themeColors.primary || DS.primary);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={handleDismiss}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <Animated.View style={[styles.modalOverlay, overlayStyle]}>
        <TouchableWithoutFeedback onPress={handleDismiss}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <Animated.View style={[styles.modalContainer, modalStyle, { backgroundColor: bgColor, borderColor }]}>
          <LinearGradient colors={['#6366f1', '#ec4899']} style={styles.modalTopAccent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
          <View style={[styles.modalIconWrap]}>
            <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.modalIconGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Ionicons name="lock-closed" size={26} color={DS.white} />
            </LinearGradient>
          </View>
          <Text style={[styles.modalTitle, { color: textColor }]}>{config.title}</Text>
          {config.message && <Text style={[styles.modalMessage, { color: subTextColor }]}>{config.message}</Text>}
          <View style={[styles.promptInputContainer, { backgroundColor: inputBgColor, borderColor }]}>
            <TextInput
              ref={inputRef}
              style={[styles.promptInput, { color: textColor }]}
              value={inputValue}
              onChangeText={setInputValue}
              placeholder={config.promptPlaceholder || 'Enter value...'}
              placeholderTextColor={subTextColor}
              secureTextEntry={isSecure}
              keyboardType={getKeyboardType()}
              autoCapitalize={getAutoCapitalize()}
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleConfirm}
            />
            {config.promptType === 'secure-text' && (
              <TouchableOpacity style={{ padding: 8 }} onPress={() => setIsSecure(!isSecure)}>
                <Ionicons name={isSecure ? 'eye-off' : 'eye'} size={18} color={subTextColor} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.modalButtonRow}>
            {config.showCancel !== false && (
              <TouchableOpacity style={[styles.modalCancelButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]} onPress={handleCancel}>
                <Text style={[styles.modalCancelText, { color: isDark ? DS.gray300 : DS.gray600 }]}>{config.cancelText || 'Cancel'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.modalConfirmButton} onPress={handleConfirm}>
              <LinearGradient colors={[confirmColor, config.destructive ? '#dc2626' : (themeColors.secondary || confirmColor)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modalConfirmGradient}>
                <Text style={styles.modalConfirmText}>{config.confirmText || 'Confirm'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
const SweetAlertModal: React.FC<{ config: SweetAlertConfig; isDark: boolean; themeColors: { primary: string; secondary: string; accent: string }; onDismiss: () => void }> = React.memo(({ config, isDark, themeColors, onDismiss }) => {
  const type = config.type || 'info';
  const alertCfg = ALERT_CONFIG[type];
  const iconColor = config.iconColor || alertCfg.defaultColor;
  const confirmColor = config.destructive ? DS.danger : (config.confirmColor || themeColors.primary || DS.primary);
  const dismissCalledRef = useRef(false);

  const bgColor = isDark ? DS.darkCard : DS.white;
  const textColor = isDark ? DS.white : DS.gray900;
  const subTextColor = isDark ? DS.gray400 : DS.gray500;
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';

  const overlayOpacity = useSharedValue(0);
  const modalScale = useSharedValue(0.92);
  const modalTranslateY = useSharedValue(20);

  useEffect(() => {
    overlayOpacity.value = withTiming(1, { duration: MOTION.overlayIn, easing: MOTION.easingIn });
    modalScale.value = withSpring(1, MOTION.spring);
    modalTranslateY.value = withSpring(0, MOTION.spring);
  }, []);

  const animateOut = useCallback((callback?: () => void) => {
    overlayOpacity.value = withTiming(0, { duration: MOTION.overlayOut, easing: MOTION.easingOut });
    modalScale.value = withTiming(0.92, { duration: MOTION.exitDuration, easing: MOTION.easingOut });
    modalTranslateY.value = withTiming(20, { duration: MOTION.exitDuration, easing: MOTION.easingOut });
    setTimeout(() => callback?.(), MOTION.exitDuration);
  }, []);

  const handleConfirm = useCallback(() => {
    if (dismissCalledRef.current) return;
    dismissCalledRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    animateOut(() => { config.onConfirm?.(); onDismiss(); });
  }, [config, onDismiss, animateOut]);

  const handleCancel = useCallback(() => {
    if (dismissCalledRef.current) return;
    dismissCalledRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    animateOut(() => { config.onCancel?.(); onDismiss(); });
  }, [config, onDismiss, animateOut]);

  const handleDismiss = useCallback(() => {
    if (dismissCalledRef.current) return;
    dismissCalledRef.current = true;
    animateOut(() => { config.onDismiss?.(); onDismiss(); });
  }, [config, onDismiss, animateOut]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const modalStyle = useAnimatedStyle(() => ({ transform: [{ scale: modalScale.value }, { translateY: modalTranslateY.value }] }));

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={handleDismiss}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <Animated.View style={[styles.modalOverlay, overlayStyle]}>
        <TouchableWithoutFeedback onPress={config.type !== 'loading' ? handleDismiss : undefined}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <Animated.View style={[styles.modalContainer, modalStyle, { backgroundColor: bgColor, borderColor }]}>
          <LinearGradient colors={alertCfg.colors} style={styles.modalTopAccent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
          {type === 'loading' ? (
            <LoadingRing color={iconColor} size={52} />
          ) : (
            <View style={styles.modalIconWrap}>
              <LinearGradient colors={alertCfg.colors} style={styles.modalIconGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name={config.icon || alertCfg.icon} size={26} color={DS.white} />
              </LinearGradient>
            </View>
          )}
          <Text style={[styles.modalTitle, { color: textColor }]}>{config.title}</Text>
          {config.message && <Text style={[styles.modalMessage, { color: subTextColor }]}>{config.message}</Text>}
          {config.progress !== undefined && (
            <View style={{ width: '100%', marginBottom: 20 }}>
              <ProgressBar progress={config.progress} color={alertCfg.defaultColor} />
              <Text style={[styles.modalProgressText, { color: subTextColor }]}>{Math.round(config.progress * 100)}%</Text>
            </View>
          )}
          {config.actionButtons && config.actionButtons.length > 0 ? (
            <View style={styles.customActionsRow}>
              {config.actionButtons.map((btn, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.customActionBtn, {
                    backgroundColor:
                      btn.variant === 'primary' ? themeColors.primary :
                      btn.variant === 'danger' ? DS.danger :
                      btn.variant === 'ghost' ? 'transparent' :
                      isDark ? 'rgba(255,255,255,0.08)' : DS.gray100,
                  }]}
                  onPress={() => { btn.onPress(); if (config.type !== 'loading') handleDismiss(); }}
                  activeOpacity={0.75}
                >
                  {btn.icon && <Ionicons name={btn.icon} size={14} color={btn.variant === 'primary' || btn.variant === 'danger' ? DS.white : textColor} style={{ marginRight: 6 }} />}
                  <Text style={[styles.customActionText, { color: btn.variant === 'primary' || btn.variant === 'danger' ? DS.white : textColor }]}>{btn.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.modalButtonRow}>
              {config.showCancel !== false && config.cancelText && (
                <TouchableOpacity style={[styles.modalCancelButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]} onPress={handleCancel} activeOpacity={0.7}>
                  <Text style={[styles.modalCancelText, { color: isDark ? DS.gray300 : DS.gray600 }]}>{config.cancelText}</Text>
                </TouchableOpacity>
              )}
              {config.showConfirm !== false && (
                <TouchableOpacity style={styles.modalConfirmButton} onPress={handleConfirm} activeOpacity={0.85}>
                  <LinearGradient colors={[confirmColor, config.destructive ? '#dc2626' : (themeColors.secondary || confirmColor)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modalConfirmGradient}>
                    <Text style={styles.modalConfirmText}>{config.confirmText || 'OK'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   BOTTOM SHEET
   ═══════════════════════════════════════════════════════════════════════════ */
const SweetAlertBottomSheet: React.FC<{ config: SweetAlertConfig; isDark: boolean; themeColors: { primary: string; secondary: string; accent: string }; onDismiss: () => void }> = React.memo(({ config, isDark, themeColors, onDismiss }) => {
  const type = config.type || 'info';
  const alertCfg = ALERT_CONFIG[type];
  const translateY = useSharedValue(SCREEN_H);
  const opacity = useSharedValue(0);
  const dismissCalledRef = useRef(false);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: MOTION.overlayIn, easing: MOTION.easingIn });
    translateY.value = withSpring(0, MOTION.spring);
  }, []);

  const dismiss = useCallback(() => {
    if (dismissCalledRef.current) return;
    dismissCalledRef.current = true;
    opacity.value = withTiming(0, { duration: MOTION.overlayOut, easing: MOTION.easingOut });
    translateY.value = withTiming(SCREEN_H * 0.5, { duration: MOTION.exitDuration, easing: MOTION.easingOut });
    setTimeout(onDismiss, MOTION.exitDuration);
  }, [onDismiss]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const bgColor = isDark ? DS.darkCard : DS.white;
  const textColor = isDark ? DS.white : DS.gray900;
  const subTextColor = isDark ? DS.gray400 : DS.gray500;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.sheetOverlay, overlayStyle]}>
        <TouchableWithoutFeedback onPress={dismiss}><View style={StyleSheet.absoluteFill} /></TouchableWithoutFeedback>
        <Animated.View style={[styles.sheetContainer, sheetStyle, { backgroundColor: bgColor }]}>
          <View style={styles.sheetHandleBar}>
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : DS.gray300 }]} />
          </View>
          <View style={styles.sheetIconWrap}>
            <LinearGradient colors={alertCfg.colors} style={styles.sheetIconGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Ionicons name={config.icon || alertCfg.icon} size={26} color={DS.white} />
            </LinearGradient>
          </View>
          <Text style={[styles.sheetTitle, { color: textColor }]}>{config.title}</Text>
          {config.message && <Text style={[styles.sheetMessage, { color: subTextColor }]}>{config.message}</Text>}
          <View style={styles.sheetButtonCol}>
            {config.showConfirm !== false && (
              <TouchableOpacity style={styles.sheetPrimaryBtn} onPress={() => { config.onConfirm?.(); dismiss(); }}>
                <LinearGradient colors={[themeColors.primary || DS.primary, themeColors.secondary || DS.accent]} style={styles.sheetPrimaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={styles.sheetPrimaryText}>{config.confirmText || 'OK'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            {config.showCancel !== false && config.cancelText && (
              <TouchableOpacity style={[styles.sheetSecondaryBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]} onPress={() => { config.onCancel?.(); dismiss(); }}>
                <Text style={[styles.sheetSecondaryText, { color: subTextColor }]}>{config.cancelText}</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   PROVIDER
   ═══════════════════════════════════════════════════════════════════════════ */
interface AlertQueueItem { id: string; config: SweetAlertConfig; }

interface SweetAlertProviderProps {
  children: React.ReactNode;
  isDark: boolean;
  themeColors: { primary: string; secondary: string; accent: string };
  reduceMotion?: boolean;
}

export const SweetAlertProvider: React.FC<SweetAlertProviderProps> = ({ children, isDark, themeColors, reduceMotion = false }) => {
  const [toastQueue, setToastQueue] = useState<AlertQueueItem[]>([]);
  const [modalQueue, setModalQueue] = useState<AlertQueueItem[]>([]);
  const [sheetQueue, setSheetQueue] = useState<AlertQueueItem[]>([]);
  const [promptQueue, setPromptQueue] = useState<AlertQueueItem[]>([]);
  const idCounter = useRef(0);
  const lastFiredRef = useRef<{ signature: string; at: number } | null>(null);

  const reduceMotionRef = useRef(reduceMotion);
  useEffect(() => { reduceMotionRef.current = reduceMotion; }, [reduceMotion]);

  // Register dedup reset so emitHide() can clear it.
  useEffect(() => {
    const reset = () => { lastFiredRef.current = null; };
    dedupResetFns.add(reset);
    return () => { dedupResetFns.delete(reset); };
  }, []);

  const sweetAlert = useCallback((config: SweetAlertConfig) => {
    const signature = `${config.style || 'toast'}|${config.type || 'info'}|${config.title}|${config.message || ''}`;
    const now = Date.now();
    if (lastFiredRef.current && lastFiredRef.current.signature === signature && now - lastFiredRef.current.at < 500) {
      return;
    }
    lastFiredRef.current = { signature, at: now };

    const id = `alert_${++idCounter.current}_${now}`;
    const fullConfig = { ...config, reduceMotion: config.reduceMotion ?? reduceMotionRef.current };

    if (config.isPrompt) {
      setToastQueue([]);
      setPromptQueue((prev) => [...prev, { id, config: fullConfig }]);
    } else {
      const style = fullConfig.style || 'toast';
      if (style === 'modal') {
        setToastQueue([]);
        setModalQueue((prev) => [...prev, { id, config: fullConfig }]);
      } else if (style === 'bottom-sheet') {
        setToastQueue([]);
        setSheetQueue((prev) => [...prev, { id, config: fullConfig }]);
      } else {
        setToastQueue((prev) => [...prev, { id, config: fullConfig }]);
      }
    }

    if (fullConfig.haptic !== false && fullConfig.type !== 'loading') {
      const t = fullConfig.type || 'info';
      Haptics.notificationAsync(ALERT_CONFIG[t].hapticType).catch(() => {});
    }
  }, []);

  useEffect(() => {
    providerMountCount += 1;
    const handleShow: AlertListener = (config) => sweetAlert(config);
    const handleHide: HideListener = () => {
      setTimeout(() => {
        setModalQueue([]);
        setToastQueue([]);
        setSheetQueue([]);
        setPromptQueue([]);
      }, MOTION.exitDuration);
    };
    alertListeners.add(handleShow);
    hideListeners.add(handleHide);

    const t = setTimeout(flushQueue, 0);

    return () => {
      clearTimeout(t);
      providerMountCount = Math.max(0, providerMountCount - 1);
      alertListeners.delete(handleShow);
      hideListeners.delete(handleHide);
    };
  }, [sweetAlert]);

  const dismissToast = useCallback((id: string) => setToastQueue((prev) => prev.filter((i) => i.id !== id)), []);
  const dismissModal = useCallback((id: string) => setModalQueue((prev) => prev.filter((i) => i.id !== id)), []);
  const dismissSheet = useCallback((id: string) => setSheetQueue((prev) => prev.filter((i) => i.id !== id)), []);
  const dismissPrompt = useCallback((id: string) => setPromptQueue((prev) => prev.filter((i) => i.id !== id)), []);

  const activeModal = modalQueue[0] || null;
  const activeSheet = sheetQueue[0] || null;
  const activePrompt = promptQueue[0] || null;

  return (
    <>
      {children}
      {toastQueue.map((item) => (
        <SweetAlertToast key={item.id} config={item.config} isDark={isDark} onDismiss={() => dismissToast(item.id)} />
      ))}
      {activeModal && <SweetAlertModal key={activeModal.id} config={activeModal.config} isDark={isDark} themeColors={themeColors} onDismiss={() => dismissModal(activeModal.id)} />}
      {activeSheet && <SweetAlertBottomSheet key={activeSheet.id} config={activeSheet.config} isDark={isDark} themeColors={themeColors} onDismiss={() => dismissSheet(activeSheet.id)} />}
      {activePrompt && <SweetAlertPrompt key={activePrompt.id} config={activePrompt.config} isDark={isDark} themeColors={themeColors} onDismiss={() => dismissPrompt(activePrompt.id)} />}
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   HOOK
   ═══════════════════════════════════════════════════════════════════════════ */
export const useSweetAlert = () => {
  const toast = useCallback((title: string, message?: string, type: AlertType = 'info') => {
    showSweetAlert({ title, message, type, style: 'toast', position: 'top', autoDismiss: true, duration: 3000 });
  }, []);
  const success = useCallback((title: string, message?: string) => {
    showSweetAlert({ title, message, type: 'success', style: 'toast', position: 'top', autoDismiss: true, duration: 2500 });
  }, []);
  const error = useCallback((title: string, message?: string) => {
    showSweetAlert({ title, message, type: 'error', style: 'toast', position: 'top', autoDismiss: true, duration: 4000 });
  }, []);
  const warning = useCallback((title: string, message?: string) => {
    showSweetAlert({ title, message, type: 'warning', style: 'toast', position: 'top', autoDismiss: true, duration: 3500 });
  }, []);
  const info = useCallback((title: string, message?: string) => {
    showSweetAlert({ title, message, type: 'info', style: 'toast', position: 'top', autoDismiss: true, duration: 3000 });
  }, []);
  const confirm = useCallback((title: string, message: string, onConfirm: () => void, onCancel?: () => void, confirmText?: string, cancelText?: string, isDanger?: boolean) => {
    showSweetAlert({ title, message, type: 'question', style: 'modal', showCancel: true, showConfirm: true, confirmText: confirmText || 'Confirm', cancelText: cancelText || 'Cancel', destructive: isDanger, onConfirm, onCancel });
  }, []);
  const alert = useCallback((title: string, message?: string, type: AlertType = 'info') => {
    showSweetAlert({ title, message, type, style: 'modal', showConfirm: true, showCancel: false, confirmText: 'OK' });
  }, []);
  const bottomSheet = useCallback((title: string, message?: string, onConfirm?: () => void, confirmText?: string, type: AlertType = 'info') => {
    showSweetAlert({ title, message, type, style: 'bottom-sheet', showConfirm: true, showCancel: true, confirmText: confirmText || 'Done', cancelText: 'Close', onConfirm });
  }, []);
  const loading = useCallback((title: string, message?: string, progress?: number) => {
    showSweetAlert({ title, message, type: 'loading', style: 'modal', showConfirm: false, showCancel: false, progress, autoDismiss: false });
  }, []);
  const hideLoading = useCallback(() => hideSweetAlert(), []);
  const show = useCallback((config: SweetAlertConfig) => showSweetAlert(config), []);
  const hide = useCallback(() => hideSweetAlert(), []);
  const prompt = useCallback((title: string, message: string, type: PromptType = 'plain-text', onConfirm: (value: string) => void, onCancel?: () => void, confirmText = 'Confirm', cancelText = 'Cancel', placeholder?: string, defaultValue?: string) => {
    showSweetAlert({
      title, message, isPrompt: true, promptType: type,
      promptPlaceholder: placeholder || (type === 'secure-text' ? 'Enter your password...' : 'Enter value...'),
      promptValue: defaultValue || '',
      showCancel: true, showConfirm: true, confirmText, cancelText,
      onPromptConfirm: onConfirm, onPromptCancel: onCancel,
      destructive: type === 'secure-text',
    });
  }, []);
  const securePrompt = useCallback((title: string, message: string, onConfirm: (password: string) => void, onCancel?: () => void, confirmText = 'Confirm', cancelText = 'Cancel') => {
    prompt(title, message, 'secure-text', onConfirm, onCancel, confirmText, cancelText, 'Enter your password...');
  }, [prompt]);

  return useMemo(() => ({ toast, success, error, warning, info, confirm, alert, bottomSheet, loading, hideLoading, show, hide, prompt, securePrompt }), [
    toast, success, error, warning, info, confirm, alert, bottomSheet, loading, hideLoading, show, hide, prompt, securePrompt,
  ]);
};

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 8, width: '100%' },
  progressFill: { height: '100%', borderRadius: 2 },

  toastWrapper: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 99999, elevation: 99999, paddingHorizontal: 16 },
  toastTop: { top: Platform.OS === 'ios' ? 52 : 36 },
  toastCenter: { top: '40%' },
  toastBottom: { bottom: Platform.OS === 'ios' ? 100 : 80 },
  toastBox: {
    flexDirection: 'row', alignItems: 'flex-start', borderRadius: DS.radius.lg,
    padding: 12, paddingRight: 10, minWidth: 260, maxWidth: SCREEN_W - 32,
    borderWidth: 1, ...DS.shadow.md, overflow: 'hidden',
  },
  toastAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderTopLeftRadius: DS.radius.lg, borderBottomLeftRadius: DS.radius.lg },
  toastIconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 10, marginLeft: 6 },
  toastTitle: { fontSize: 13, fontWeight: '800', lineHeight: 18 },
  toastMessage: { fontSize: 11, lineHeight: 16, marginTop: 2, fontWeight: '500' },
  toastClose: { padding: 4, marginLeft: 4, marginTop: 2 },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(12,10,9,0.55)', padding: 24 },
  modalContainer: {
    width: Math.min(SCREEN_W - 48, 380), borderRadius: DS.radius['2xl'],
    padding: 24, paddingTop: 28, alignItems: 'center',
    borderWidth: 1, overflow: 'hidden', ...DS.shadow.lg,
  },
  modalTopAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  modalIconWrap: { marginBottom: 16 },
  modalIconGradient: {
    width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', ...DS.shadow.md,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 8, letterSpacing: -0.3, lineHeight: 24 },
  modalMessage: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 19, marginBottom: 20, paddingHorizontal: 4 },
  modalProgressText: { fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 6 },
  modalButtonRow: { flexDirection: 'row', gap: 10, width: '100%' },
  modalCancelButton: { flex: 1, paddingVertical: 13, borderRadius: DS.radius.md, alignItems: 'center' },
  modalCancelText: { fontSize: 14, fontWeight: '700' },
  modalConfirmButton: { flex: 1, borderRadius: DS.radius.md, overflow: 'hidden' },
  modalConfirmGradient: { paddingVertical: 13, alignItems: 'center' },
  modalConfirmText: { color: DS.white, fontSize: 14, fontWeight: '800' },

  promptInputContainer: {
    flexDirection: 'row', alignItems: 'center', width: '100%',
    borderRadius: DS.radius.md, paddingHorizontal: 14, marginBottom: 18,
    borderWidth: 1, minHeight: 48,
  },
  promptInput: { flex: 1, fontSize: 14, fontWeight: '500', paddingVertical: 12 },

  customActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%', justifyContent: 'center' },
  customActionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: DS.radius.md },
  customActionText: { fontSize: 13, fontWeight: '700' },

  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12,10,9,0.5)' },
  sheetContainer: {
    borderTopLeftRadius: DS.radius['2xl'], borderTopRightRadius: DS.radius['2xl'],
    paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 6, alignItems: 'center', ...DS.shadow.lg,
  },
  sheetHandleBar: { width: '100%', alignItems: 'center', paddingVertical: 8 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2 },
  sheetIconWrap: { marginVertical: 14 },
  sheetIconGradient: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 8, letterSpacing: -0.3 },
  sheetMessage: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 19, marginBottom: 20, paddingHorizontal: 8 },
  sheetButtonCol: { width: '100%', gap: 8 },
  sheetPrimaryBtn: { width: '100%', borderRadius: DS.radius.md, overflow: 'hidden' },
  sheetPrimaryGradient: { paddingVertical: 14, alignItems: 'center' },
  sheetPrimaryText: { color: DS.white, fontSize: 14, fontWeight: '800' },
  sheetSecondaryBtn: { width: '100%', borderRadius: DS.radius.md, paddingVertical: 13, alignItems: 'center' },
  sheetSecondaryText: { fontSize: 13, fontWeight: '700' },
});

export default SweetAlertProvider;