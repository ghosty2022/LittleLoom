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
  Animated as RNAnimated,
  Easing as RNEasing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  runOnJS,
  FadeInUp,
  FadeOutDown,
  Easing,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Types ──────────────────────────────────────────────────────────

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'question' | 'loading';
export type AlertStyle = 'toast' | 'modal' | 'bottom-sheet';
export type AlertPosition = 'top' | 'center' | 'bottom';

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
  // Modern additions
  icon?: keyof typeof Ionicons.glyphMap;
  progress?: number; // 0-1 for loading
  actionButtons?: {
    text: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    icon?: keyof typeof Ionicons.glyphMap;
  }[];
}

// ─── Color System ───────────────────────────────────────────────────

const ALERT_CONFIG: Record<AlertType, {
  colors: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
  defaultColor: string;
  hapticType: Haptics.NotificationFeedbackType;
  bgTint: string;
}> = {
  success: {
    colors: ['#10b981', '#34d399'],
    icon: 'checkmark-circle',
    defaultColor: '#10b981',
    hapticType: Haptics.NotificationFeedbackType.Success,
    bgTint: 'rgba(16,185,129,0.08)',
  },
  error: {
    colors: ['#ef4444', '#f87171'],
    icon: 'close-circle',
    defaultColor: '#ef4444',
    hapticType: Haptics.NotificationFeedbackType.Error,
    bgTint: 'rgba(239,68,68,0.08)',
  },
  warning: {
    colors: ['#f59e0b', '#fbbf24'],
    icon: 'warning',
    defaultColor: '#f59e0b',
    hapticType: Haptics.NotificationFeedbackType.Warning,
    bgTint: 'rgba(245,158,11,0.08)',
  },
  info: {
    colors: ['#3b82f6', '#60a5fa'],
    icon: 'information-circle',
    defaultColor: '#3b82f6',
    hapticType: Haptics.NotificationFeedbackType.Success,
    bgTint: 'rgba(59,130,246,0.08)',
  },
  question: {
    colors: ['#8b5cf6', '#a78bfa'],
    icon: 'help-circle',
    defaultColor: '#8b5cf6',
    hapticType: Haptics.NotificationFeedbackType.Success,
    bgTint: 'rgba(139,92,246,0.08)',
  },
  loading: {
    colors: ['#6366f1', '#818cf8'],
    icon: 'sync',
    defaultColor: '#6366f1',
    hapticType: Haptics.NotificationFeedbackType.Success,
    bgTint: 'rgba(99,102,241,0.08)',
  },
};

// ─── Event System ───────────────────────────────────────────────────

type AlertListener = (config: SweetAlertConfig) => void;
type HideListener = () => void;

const alertListeners: Set<AlertListener> = new Set();
const hideListeners: Set<HideListener> = new Set();
const pendingQueue: SweetAlertConfig[] = [];
const MAX_QUEUE_SIZE = 50;
let isProviderMounted = false;

const flushQueue = () => {
  if (!isProviderMounted || pendingQueue.length === 0) return;
  const queue = [...pendingQueue];
  pendingQueue.length = 0;
  queue.forEach(config => {
    alertListeners.forEach(listener => listener(config));
  });
};

const emitShow = (config: SweetAlertConfig) => {
  if (!isProviderMounted) {
    if (pendingQueue.length < MAX_QUEUE_SIZE) {
      pendingQueue.push(config);
    }
    return;
  }
  alertListeners.forEach(listener => listener(config));
};

const emitHide = () => {
  hideListeners.forEach(listener => listener());
};

// ─── Public API ─────────────────────────────────────────────────────

export const showSweetAlert = (config: SweetAlertConfig) => emitShow(config);
export const hideSweetAlert = () => emitHide();

// ─── Animated Ring (for loading) ──────────────────────────────────

const LoadingRing: React.FC<{ color: string; size?: number }> = React.memo(({ color, size = 40 }) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withTiming(360, { 
      duration: 1000, 
      easing: Easing.linear 
    });
    const interval = setInterval(() => {
      rotation.value = 0;
      rotation.value = withTiming(360, { 
        duration: 1000, 
        easing: Easing.linear 
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={[animatedStyle, { width: size, height: size, justifyContent: 'center', alignItems: 'center' }]}>
      <View style={[styles.loadingRing, { 
        width: size, 
        height: size, 
        borderRadius: size / 2,
        borderColor: `${color}30`,
        borderTopColor: color,
        borderWidth: 3,
      }]} />
    </Animated.View>
  );
});

// ─── Progress Bar ───────────────────────────────────────────────────

const ProgressBar: React.FC<{ progress: number; color: string }> = React.memo(({ progress, color }) => {
  const widthAnim = useSharedValue(0);

  useEffect(() => {
    widthAnim.value = withTiming(progress, { duration: 300, easing: Easing.out(Easing.ease) });
  }, [progress, widthAnim]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${widthAnim.value * 100}%`,
  }));

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, animatedStyle, { backgroundColor: color }]} />
    </View>
  );
});

// ─── Toast Component ────────────────────────────────────────────────

interface ToastProps {
  config: SweetAlertConfig;
  isDark: boolean;
  onDismiss: () => void;
}

const SweetAlertToast: React.FC<ToastProps> = React.memo(({ config, isDark, onDismiss }) => {
  const type = config.type || 'info';
  const alertCfg = ALERT_CONFIG[type];
  const duration = config.duration || (type === 'error' ? 4000 : type === 'success' ? 2500 : 3000);
  const position = config.position || 'top';
  const reduceMotion = config.reduceMotion ?? false;

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(position === 'top' ? -80 : position === 'bottom' ? 80 : 30);
  const scale = useSharedValue(0.9);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef(0);

  const dismissToast = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (reduceMotion) {
      runOnJS(onDismiss)();
    } else {
      opacity.value = withTiming(0, { duration: 250, easing: Easing.inOut(Easing.ease) });
      translateY.value = withTiming(
        position === 'top' ? -60 : position === 'bottom' ? 60 : 20,
        { duration: 250, easing: Easing.inOut(Easing.ease) }
      );
      scale.value = withTiming(0.9, { duration: 250 });
      dismissTimerRef.current = setTimeout(() => runOnJS(onDismiss)(), 250);
    }
  }, [reduceMotion, position, onDismiss, opacity, translateY, scale]);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      translateY.value = 0;
      scale.value = 1;
    } else {
      opacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.back(1.5)) });
      translateY.value = withSpring(0, { damping: 15, stiffness: 200 });
      scale.value = withSpring(1, { damping: 12 });
    }

    if (config.autoDismiss !== false) {
      dismissTimerRef.current = setTimeout(() => {
        dismissToast();
      }, duration);
    }

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [reduceMotion, duration, config.autoDismiss, dismissToast, opacity, translateY, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const bgColor = isDark ? '#1e1e2e' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  return (
    <View
      style={[
        styles.toastWrapper,
        position === 'top' && styles.toastTop,
        position === 'center' && styles.toastCenter,
        position === 'bottom' && styles.toastBottom,
      ]}
      pointerEvents="box-none"
    >
      <Animated.View 
        style={[
          animatedStyle, 
          styles.toastBox, 
          { 
            backgroundColor: bgColor,
            borderColor,
            shadowColor: alertCfg.defaultColor,
          }
        ]}
      >
        {/* Left accent line */}
        <View style={[styles.toastAccent, { backgroundColor: alertCfg.defaultColor }]} />

        {/* Icon */}
        <View style={[styles.toastIconWrap, { backgroundColor: alertCfg.bgTint }]}>
          <Ionicons 
            name={config.icon || alertCfg.icon} 
            size={22} 
            color={alertCfg.defaultColor} 
          />
        </View>

        {/* Content */}
        <View style={styles.toastTextContainer}>
          <Text style={[styles.toastTitle, { color: textColor }]} numberOfLines={2}>
            {config.title}
          </Text>
          {config.message && (
            <Text style={[styles.toastMessage, { color: subTextColor }]} numberOfLines={3}>
              {config.message}
            </Text>
          )}
          {config.progress !== undefined && (
            <ProgressBar progress={config.progress} color={alertCfg.defaultColor} />
          )}
        </View>

        {/* Close */}
        <TouchableOpacity 
          onPress={dismissToast} 
          style={styles.toastClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.6}
        >
          <Ionicons name="close" size={18} color={subTextColor} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
});

// ─── Modal Component ────────────────────────────────────────────────

interface ModalProps {
  config: SweetAlertConfig;
  isDark: boolean;
  themeColors: { primary: string; secondary: string; accent: string };
  onDismiss: () => void;
}

const SweetAlertModal: React.FC<ModalProps> = React.memo(({ config, isDark, themeColors, onDismiss }) => {
  const type = config.type || 'info';
  const alertCfg = ALERT_CONFIG[type];

  const iconColor = config.iconColor || alertCfg.defaultColor;
  const confirmColor = config.destructive ? '#ef4444' : (config.confirmColor || themeColors.primary);

  const bgColor = isDark ? '#1a1a2e' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#1a1a1a';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  const overlayOpacity = useSharedValue(0);
  const modalScale = useSharedValue(0.85);
  const modalTranslateY = useSharedValue(30);

  useEffect(() => {
    overlayOpacity.value = withTiming(1, { duration: 200 });
    modalScale.value = withSpring(1, { damping: 14, stiffness: 200 });
    modalTranslateY.value = withSpring(0, { damping: 14 });
  }, [overlayOpacity, modalScale, modalTranslateY]);

  const animateOut = useCallback((callback?: () => void) => {
    overlayOpacity.value = withTiming(0, { duration: 180 });
    modalScale.value = withTiming(0.9, { duration: 180 });
    modalTranslateY.value = withTiming(20, { duration: 180 });
    setTimeout(() => callback?.(), 180);
  }, [overlayOpacity, modalScale, modalTranslateY]);

  const handleConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    animateOut(() => {
      config.onConfirm?.();
      onDismiss();
    });
  }, [config, onDismiss, animateOut]);

  const handleCancel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    animateOut(() => {
      config.onCancel?.();
      onDismiss();
    });
  }, [config, onDismiss, animateOut]);

  const handleDismiss = useCallback(() => {
    animateOut(() => {
      config.onDismiss?.();
      onDismiss();
    });
  }, [config, onDismiss, animateOut]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const modalStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: modalScale.value },
      { translateY: modalTranslateY.value },
    ],
  }));

  const renderIcon = () => {
    if (type === 'loading') {
      return <LoadingRing color={iconColor} size={56} />;
    }
    return (
      <View style={[styles.modalIconWrap, { backgroundColor: alertCfg.bgTint }]}>
        <LinearGradient
          colors={alertCfg.colors}
          style={styles.modalIconGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name={config.icon || alertCfg.icon} size={28} color="#fff" />
        </LinearGradient>
      </View>
    );
  };

  return (
    <Modal
      visible={true}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <Animated.View style={[styles.modalOverlay, overlayStyle]}>
        <TouchableWithoutFeedback onPress={config.type !== 'loading' ? handleDismiss : undefined}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <Animated.View style={[styles.modalContainer, modalStyle, { backgroundColor: bgColor, borderColor }]}>
          {/* Top gradient accent */}
          <LinearGradient
            colors={alertCfg.colors}
            style={styles.modalTopAccent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />

          {/* Icon */}
          {renderIcon()}

          {/* Title */}
          <Text style={[styles.modalTitle, { color: textColor }]}>
            {config.title}
          </Text>

          {/* Message */}
          {config.message && (
            <Text style={[styles.modalMessage, { color: subTextColor }]}>
              {config.message}
            </Text>
          )}

          {/* Progress */}
          {config.progress !== undefined && (
            <View style={styles.modalProgressWrap}>
              <ProgressBar progress={config.progress} color={alertCfg.defaultColor} />
              <Text style={[styles.modalProgressText, { color: subTextColor }]}>
                {Math.round(config.progress * 100)}%
              </Text>
            </View>
          )}

          {/* Action Buttons (custom) */}
          {config.actionButtons && config.actionButtons.length > 0 && (
            <View style={styles.customActionsRow}>
              {config.actionButtons.map((btn, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.customActionBtn,
                    btn.variant === 'primary' && { backgroundColor: themeColors.primary },
                    btn.variant === 'danger' && { backgroundColor: '#ef4444' },
                    btn.variant === 'ghost' && { backgroundColor: 'transparent' },
                    btn.variant === 'secondary' || !btn.variant && { 
                      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9' 
                    },
                  ]}
                  onPress={() => {
                    btn.onPress();
                    if (config.type !== 'loading') handleDismiss();
                  }}
                  activeOpacity={0.75}
                >
                  {btn.icon && (
                    <Ionicons 
                      name={btn.icon} 
                      size={16} 
                      color={btn.variant === 'primary' || btn.variant === 'danger' ? '#fff' : textColor} 
                      style={{ marginRight: 6 }}
                    />
                  )}
                  <Text style={[
                    styles.customActionText,
                    { color: btn.variant === 'primary' || btn.variant === 'danger' ? '#fff' : textColor }
                  ]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Standard Buttons */}
          {!config.actionButtons && (
            <View style={styles.modalButtonRow}>
              {config.showCancel !== false && config.cancelText && (
                <TouchableOpacity
                  style={[
                    styles.modalCancelButton,
                    { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' },
                  ]}
                  onPress={handleCancel}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalCancelText, { color: isDark ? '#cbd5e1' : '#64748b' }]}>
                    {config.cancelText}
                  </Text>
                </TouchableOpacity>
              )}

              {config.showConfirm !== false && (
                <TouchableOpacity
                  style={styles.modalConfirmButton}
                  onPress={handleConfirm}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[confirmColor, config.destructive ? '#dc2626' : (themeColors.secondary || confirmColor)]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalConfirmGradient}
                  >
                    <Text style={styles.modalConfirmText}>
                      {config.confirmText || 'OK'}
                    </Text>
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

// ─── Bottom Sheet Component ─────────────────────────────────────────

interface BottomSheetProps {
  config: SweetAlertConfig;
  isDark: boolean;
  themeColors: { primary: string; secondary: string; accent: string };
  onDismiss: () => void;
}

const SweetAlertBottomSheet: React.FC<BottomSheetProps> = React.memo(({ config, isDark, themeColors, onDismiss }) => {
  const type = config.type || 'info';
  const alertCfg = ALERT_CONFIG[type];
  const translateY = useSharedValue(SCREEN_H);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 200 });
    translateY.value = withSpring(0, { damping: 20, stiffness: 250 });
  }, [opacity, translateY]);

  const dismiss = useCallback(() => {
    opacity.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(SCREEN_H * 0.5, { duration: 250, easing: Easing.inOut(Easing.ease) });
    setTimeout(onDismiss, 250);
  }, [onDismiss, opacity, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const bgColor = isDark ? '#1a1a2e' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#1a1a1a';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <Modal visible={true} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.sheetOverlay, overlayStyle]}>
        <TouchableWithoutFeedback onPress={dismiss}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <Animated.View style={[styles.sheetContainer, sheetStyle, { backgroundColor: bgColor }]}>
          {/* Handle bar */}
          <View style={styles.sheetHandleBar}>
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />
          </View>

          {/* Icon */}
          <View style={[styles.sheetIconWrap, { backgroundColor: alertCfg.bgTint }]}>
            <LinearGradient colors={alertCfg.colors} style={styles.sheetIconGradient}>
              <Ionicons name={config.icon || alertCfg.icon} size={28} color="#fff" />
            </LinearGradient>
          </View>

          <Text style={[styles.sheetTitle, { color: textColor }]}>{config.title}</Text>
          {config.message && (
            <Text style={[styles.sheetMessage, { color: subTextColor }]}>{config.message}</Text>
          )}

          <View style={styles.sheetButtonCol}>
            {config.showConfirm !== false && (
              <TouchableOpacity style={styles.sheetPrimaryBtn} onPress={() => { config.onConfirm?.(); dismiss(); }} activeOpacity={0.8}>
                <LinearGradient colors={[themeColors.primary, themeColors.secondary || themeColors.primary]} style={styles.sheetPrimaryGradient}>
                  <Text style={styles.sheetPrimaryText}>{config.confirmText || 'OK'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            {config.showCancel !== false && config.cancelText && (
              <TouchableOpacity style={[styles.sheetSecondaryBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]} onPress={() => { config.onCancel?.(); dismiss(); }} activeOpacity={0.7}>
                <Text style={[styles.sheetSecondaryText, { color: subTextColor }]}>{config.cancelText}</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
});

// ─── Queue Item Type ────────────────────────────────────────────────

interface AlertQueueItem {
  id: string;
  config: SweetAlertConfig;
}

// ─── Provider Props ─────────────────────────────────────────────────

interface SweetAlertProviderProps {
  children: React.ReactNode;
  isDark: boolean;
  themeColors: { primary: string; secondary: string; accent: string };
  reduceMotion?: boolean;
}

// ─── Provider ───────────────────────────────────────────────────────

export const SweetAlertProvider: React.FC<SweetAlertProviderProps> = ({
  children,
  isDark,
  themeColors,
  reduceMotion = false,
}) => {
  const [toastQueue, setToastQueue] = useState<AlertQueueItem[]>([]);
  const [modalQueue, setModalQueue] = useState<AlertQueueItem[]>([]);
  const [sheetQueue, setSheetQueue] = useState<AlertQueueItem[]>([]);
  const idCounter = useRef(0);

  const sweetAlert = useCallback((config: SweetAlertConfig) => {
    const id = `alert_${++idCounter.current}_${Date.now()}`;
    const fullConfig = { ...config, reduceMotion: config.reduceMotion ?? reduceMotion };
    const style = fullConfig.style || 'toast';

    if (style === 'modal') {
      setModalQueue(prev => [...prev, { id, config: fullConfig }]);
    } else if (style === 'bottom-sheet') {
      setSheetQueue(prev => [...prev, { id, config: fullConfig }]);
    } else {
      setToastQueue(prev => [...prev, { id, config: fullConfig }]);
    }

    if (fullConfig.haptic !== false) {
      const type = fullConfig.type || 'info';
      Haptics.notificationAsync(ALERT_CONFIG[type].hapticType).catch(() => {});
    }
  }, [reduceMotion]);

  useEffect(() => {
    isProviderMounted = true;

    const handleShow: AlertListener = (config) => sweetAlert(config);
    const handleHide: HideListener = () => {
      setModalQueue([]);
      setToastQueue([]);
      setSheetQueue([]);
    };

    alertListeners.add(handleShow);
    hideListeners.add(handleHide);
    flushQueue();

    return () => {
      isProviderMounted = false;
      alertListeners.delete(handleShow);
      hideListeners.delete(handleHide);
    };
  }, [sweetAlert]);

  const dismissToast = useCallback((id: string) => {
    setToastQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  const dismissModal = useCallback((id: string) => {
    setModalQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  const dismissSheet = useCallback((id: string) => {
    setSheetQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  const activeModal = modalQueue[0] || null;
  const activeSheet = sheetQueue[0] || null;

  return (
    <>
      {children}

      {/* Toasts */}
      {toastQueue.map(item => (
        <SweetAlertToast
          key={item.id}
          config={item.config}
          isDark={isDark}
          onDismiss={() => dismissToast(item.id)}
        />
      ))}

      {/* Modals */}
      {activeModal && (
        <SweetAlertModal
          key={activeModal.id}
          config={activeModal.config}
          isDark={isDark}
          themeColors={themeColors}
          onDismiss={() => dismissModal(activeModal.id)}
        />
      )}

      {/* Bottom Sheets */}
      {activeSheet && (
        <SweetAlertBottomSheet
          key={activeSheet.id}
          config={activeSheet.config}
          isDark={isDark}
          themeColors={themeColors}
          onDismiss={() => dismissSheet(activeSheet.id)}
        />
      )}
    </>
  );
};

// ─── Hook ───────────────────────────────────────────────────────────

export const useSweetAlert = () => {
  const toast = useCallback((title: string, message?: string, type: AlertType = 'info') => {
    showSweetAlert({ 
      title, 
      message, 
      type, 
      style: 'toast', 
      position: 'top', 
      autoDismiss: true, 
      duration: 3000 
    });
  }, []);

  const success = useCallback((title: string, message?: string) => {
    showSweetAlert({ 
      title, 
      message, 
      type: 'success', 
      style: 'toast', 
      position: 'top', 
      autoDismiss: true, 
      duration: 2500 
    });
  }, []);

  const error = useCallback((title: string, message?: string) => {
    showSweetAlert({ 
      title, 
      message, 
      type: 'error', 
      style: 'toast', 
      position: 'top', 
      autoDismiss: true, 
      duration: 4000 
    });
  }, []);

  const warning = useCallback((title: string, message?: string) => {
    showSweetAlert({ 
      title, 
      message, 
      type: 'warning', 
      style: 'toast', 
      position: 'top', 
      autoDismiss: true, 
      duration: 3500 
    });
  }, []);

  const info = useCallback((title: string, message?: string) => {
    showSweetAlert({ 
      title, 
      message, 
      type: 'info', 
      style: 'toast', 
      position: 'top', 
      autoDismiss: true, 
      duration: 3000 
    });
  }, []);

  const confirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string,
    isDanger?: boolean
  ) => {
    showSweetAlert({
      title,
      message,
      type: 'question',
      style: 'modal',
      showCancel: true,
      showConfirm: true,
      confirmText: confirmText || 'Confirm',
      cancelText: cancelText || 'Cancel',
      destructive: isDanger,
      onConfirm,
      onCancel,
    });
  }, []);

  const alert = useCallback((title: string, message?: string, type: AlertType = 'info') => {
    showSweetAlert({
      title,
      message,
      type,
      style: 'modal',
      showConfirm: true,
      showCancel: false,
      confirmText: 'OK',
    });
  }, []);

  const bottomSheet = useCallback((
    title: string,
    message?: string,
    onConfirm?: () => void,
    confirmText?: string,
    type: AlertType = 'info'
  ) => {
    showSweetAlert({
      title,
      message,
      type,
      style: 'bottom-sheet',
      showConfirm: true,
      showCancel: true,
      confirmText: confirmText || 'Done',
      cancelText: 'Close',
      onConfirm,
    });
  }, []);

  const loading = useCallback((title: string, message?: string, progress?: number) => {
    showSweetAlert({
      title,
      message,
      type: 'loading',
      style: 'modal',
      showConfirm: false,
      showCancel: false,
      progress,
      autoDismiss: false,
    });
  }, []);

  const hideLoading = useCallback(() => {
    hideSweetAlert();
  }, []);

  const show = useCallback((config: SweetAlertConfig) => {
    showSweetAlert(config);
  }, []);

  const hide = useCallback(() => {
    hideSweetAlert();
  }, []);

  return useMemo(() => ({
    toast, success, error, warning, info, confirm, alert, 
    bottomSheet, loading, hideLoading, show, hide
  }), [toast, success, error, warning, info, confirm, alert, 
       bottomSheet, loading, hideLoading, show, hide]);
};

// ─── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Loading ──────────────────────────────────────────────────────
  loadingRing: {
    borderStyle: 'solid',
  },

  // ── Progress ─────────────────────────────────────────────────────
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
    marginTop: 8,
    width: '100%',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },

  // ── Toast ────────────────────────────────────────────────────────
  toastWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99999,
    elevation: 99999,
    paddingHorizontal: 16,
  },
  toastTop: {
    top: Platform.OS === 'ios' ? 52 : 36,
  },
  toastCenter: {
    top: '40%',
  },
  toastBottom: {
    bottom: Platform.OS === 'ios' ? 100 : 80,
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 20,
    padding: 14,
    paddingRight: 12,
    minWidth: 280,
    maxWidth: SCREEN_W - 32,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
    overflow: 'hidden',
  },
  toastAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  toastIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginLeft: 6,
  },
  toastTextContainer: {
    flex: 1,
    paddingRight: 4,
  },
  toastTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  toastMessage: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  toastClose: {
    padding: 4,
    marginLeft: 4,
    marginTop: 2,
  },

  // ── Modal ────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 24,
  },
  modalContainer: {
    width: Math.min(SCREEN_W - 48, 380),
    borderRadius: 28,
    padding: 28,
    paddingTop: 32,
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.2,
    shadowRadius: 48,
    elevation: 24,
  },
  modalTopAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  modalIconWrap: {
    marginBottom: 20,
  },
  modalIconGradient: {
    width: 64,
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  modalMessage: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  modalProgressWrap: {
    width: '100%',
    marginBottom: 20,
  },
  modalProgressText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalConfirmButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalConfirmGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },

  // ── Custom Actions ───────────────────────────────────────────────
  customActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
    justifyContent: 'center',
  },
  customActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  customActionText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Bottom Sheet ─────────────────────────────────────────────────
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetContainer: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 24,
  },
  sheetHandleBar: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  sheetIconWrap: {
    marginVertical: 16,
  },
  sheetIconGradient: {
    width: 64,
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  sheetMessage: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  sheetButtonCol: {
    width: '100%',
    gap: 10,
  },
  sheetPrimaryBtn: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
  },
  sheetPrimaryGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  sheetPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  sheetSecondaryBtn: {
    width: '100%',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sheetSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
  },
});

export default SweetAlertProvider;