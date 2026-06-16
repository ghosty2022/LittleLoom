import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  FadeInUp,
  FadeOutUp,
  Easing,
  Extrapolate,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_W } = Dimensions.get('window');

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'question';
export type AlertStyle = 'toast' | 'modal';
export type AlertPosition = 'top' | 'center';

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
  cancelColor?: string;
  iconColor?: string;
  haptic?: boolean;
  reduceMotion?: boolean;
}

const ALERT_CONFIG: Record<AlertType, {
  colors: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
  defaultColor: string;
  hapticType: Haptics.NotificationFeedbackType;
}> = {
  success: {
    colors: ['#22c55e', '#4ade80'],
    icon: 'checkmark-circle',
    defaultColor: '#22c55e',
    hapticType: Haptics.NotificationFeedbackType.Success,
  },
  error: {
    colors: ['#ef4444', '#f87171'],
    icon: 'close-circle',
    defaultColor: '#ef4444',
    hapticType: Haptics.NotificationFeedbackType.Error,
  },
  warning: {
    colors: ['#f59e0b', '#fbbf24'],
    icon: 'warning',
    defaultColor: '#f59e0b',
    hapticType: Haptics.NotificationFeedbackType.Warning,
  },
  info: {
    colors: ['#3b82f6', '#60a5fa'],
    icon: 'information-circle',
    defaultColor: '#3b82f6',
    hapticType: Haptics.NotificationFeedbackType.Success,
  },
  question: {
    colors: ['#8b5cf6', '#a78bfa'],
    icon: 'help-circle',
    defaultColor: '#8b5cf6',
    hapticType: Haptics.NotificationFeedbackType.Success,
  },
};

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

export const showSweetAlert = (config: SweetAlertConfig) => {
  emitShow(config);
};

export const hideSweetAlert = () => {
  emitHide();
};

interface DotProps {
  index: number;
  totalDots: number;
  progress: Animated.SharedValue<number>;
  colors: [string, string, string, string];
  size: number;
}

const LiquidDot: React.FC<DotProps> = React.memo(({ index, totalDots, progress, colors, size }) => {
  const offset = index / totalDots;
  const color = colors[index % colors.length];

  const dotStyle = useAnimatedStyle(() => {
    const angle = (progress.value + offset) * Math.PI * 2;
    const radius = size * 0.32;
    const x = Math.cos(angle * 1.3) * radius;
    const y = Math.sin(angle * 0.9) * radius * 0.7;
    const scale = interpolate(
      progress.value,
      [0, 0.25, 0.5, 0.75, 1],
      [0.5, 1.3, 0.7, 1.2, 0.5],
      Extrapolate.CLAMP
    );
    const opacity = interpolate(
      progress.value,
      [0, 0.2, 0.5, 0.8, 1],
      [0.3, 1, 0.6, 1, 0.3],
      Extrapolate.CLAMP
    );
    return {
      transform: [{ translateX: x }, { translateY: y }, { scale }],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.liquidDot,
        {
          backgroundColor: color,
          width: size * 0.18,
          height: size * 0.18,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 8,
        },
        dotStyle,
      ]}
    />
  );
});

interface ToastProps {
  config: SweetAlertConfig;
  isDark: boolean;
  onDismiss: () => void;
}

const SweetAlertToast: React.FC<ToastProps> = ({ config, isDark, onDismiss }) => {
  const type = config.type || 'info';
  const alertCfg = ALERT_CONFIG[type];
  const duration = config.duration || 3000;
  const position = config.position || 'top';
  const reduceMotion = config.reduceMotion ?? false;

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const translateY = useSharedValue(position === 'top' ? -50 : 20);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (reduceMotion) {
      opacity.value = 0;
      runOnJS(onDismiss)();
    } else {
      opacity.value = withTiming(0, { duration: 300, easing: Easing.inOut(Easing.ease) });
      scale.value = withTiming(0.8, { duration: 300, easing: Easing.inOut(Easing.ease) });
      translateY.value = withTiming(
        position === 'top' ? -30 : 20,
        { duration: 300, easing: Easing.inOut(Easing.ease) }
      );
      dismissTimerRef.current = setTimeout(() => runOnJS(onDismiss)(), 300);
    }
  }, [reduceMotion, position, onDismiss, opacity, scale, translateY]);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      scale.value = 1;
      translateY.value = 0;
    } else {
      opacity.value = withTiming(1, { duration: 300, easing: Easing.inOut(Easing.ease) });
      scale.value = withSpring(1, { damping: 12 });
      translateY.value = withSpring(0, { damping: 15 });
    }

    dismissTimerRef.current = setTimeout(() => {
      dismissToast();
    }, duration);

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, [reduceMotion, duration, dismissToast, opacity, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  const bgColor = isDark ? '#1a1a2e' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#1e293b';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <View
      style={[
        styles.toastContainer,
        position === 'top' ? styles.toastTop : styles.toastCenter,
      ]}
      pointerEvents="box-none"
    >
      <Animated.View style={[animatedStyle, styles.toastBox, { backgroundColor: bgColor }]}>
        <LinearGradient
          colors={alertCfg.colors}
          style={styles.toastIconBg}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name={alertCfg.icon} size={24} color="#fff" />
        </LinearGradient>
        <View style={styles.toastTextContainer}>
          <Text style={[styles.toastTitle, { color: textColor }]}>
            {config.title}
          </Text>
          {config.message && (
            <Text style={[styles.toastMessage, { color: subTextColor }]}>
              {config.message}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={dismissToast} style={styles.toastClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={18} color={subTextColor} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

interface ModalProps {
  config: SweetAlertConfig;
  isDark: boolean;
  themeColors: { primary: string; secondary: string; accent: string };
  onDismiss: () => void;
}

const SweetAlertModal: React.FC<ModalProps> = ({ config, isDark, themeColors, onDismiss }) => {
  const type = config.type || 'info';
  const alertCfg = ALERT_CONFIG[type];

  const iconColor = config.iconColor || alertCfg.defaultColor;
  const confirmColor = config.confirmColor || themeColors.primary;

  const bgColor = isDark ? '#1a1a2e' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#1a1a1a';
  const subTextColor = isDark ? '#a0a0b0' : '#64748b';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const handleConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    config.onConfirm?.();
    onDismiss();
  }, [config, onDismiss]);

  const handleCancel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    config.onCancel?.();
    onDismiss();
  }, [config, onDismiss]);

  const handleDismiss = useCallback(() => {
    config.onDismiss?.();
    onDismiss();
  }, [config, onDismiss]);

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <View style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)' }]}>
          <TouchableWithoutFeedback>
            <Animated.View
              entering={FadeInUp.springify().damping(12)}
              exiting={FadeOutUp.duration(200)}
              style={[
                styles.modalContainer,
                { backgroundColor: bgColor, borderColor },
              ]}
            >
              <View style={[styles.modalIconContainer, { backgroundColor: `${iconColor}15` }]}>
                <Ionicons name={alertCfg.icon} size={40} color={iconColor} />
              </View>

              <Text style={[styles.modalTitle, { color: textColor }]}>
                {config.title}
              </Text>

              {config.message && (
                <Text style={[styles.modalMessage, { color: subTextColor }]}>
                  {config.message}
                </Text>
              )}

              <View style={styles.modalButtonRow}>
                {config.showCancel !== false && config.cancelText && (
                  <TouchableOpacity
                    style={[
                      styles.modalCancelButton,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9' },
                    ]}
                    onPress={handleCancel}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalCancelText, { color: isDark ? '#ccc' : '#64748b' }]}>
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
                      colors={[confirmColor, themeColors.secondary || confirmColor]}
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
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

interface AlertQueueItem {
  id: string;
  config: SweetAlertConfig;
}

interface SweetAlertProviderProps {
  children: React.ReactNode;
  isDark: boolean;
  themeColors: { primary: string; secondary: string; accent: string };
  reduceMotion?: boolean;
}

export const SweetAlertProvider: React.FC<SweetAlertProviderProps> = ({
  children,
  isDark,
  themeColors,
  reduceMotion = false,
}) => {
  const [toastQueue, setToastQueue] = useState<AlertQueueItem[]>([]);
  const [modalQueue, setModalQueue] = useState<AlertQueueItem[]>([]);
  const idCounter = useRef(0);

  const sweetAlert = useCallback((config: SweetAlertConfig) => {
    const id = `alert_${++idCounter.current}`;
    const fullConfig = { ...config, reduceMotion: config.reduceMotion ?? reduceMotion };

    if (fullConfig.style === 'modal') {
      setModalQueue(prev => [...prev, { id, config: fullConfig }]);
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

  const activeModal = modalQueue[0] || null;

  return (
    <>
      {children}

      {toastQueue.map(item => (
        <SweetAlertToast
          key={item.id}
          config={item.config}
          isDark={isDark}
          onDismiss={() => dismissToast(item.id)}
        />
      ))}

      {activeModal && (
        <SweetAlertModal
          key={activeModal.id}
          config={activeModal.config}
          isDark={isDark}
          themeColors={themeColors}
          onDismiss={() => dismissModal(activeModal.id)}
        />
      )}
    </>
  );
};

export const useSweetAlert = () => {
  const sweetAlert = useCallback((config: SweetAlertConfig) => {
    showSweetAlert(config);
  }, []);

  const hideAlert = useCallback(() => {
    hideSweetAlert();
  }, []);

  const toast = useCallback((title: string, message?: string, type: AlertType = 'info') => {
    showSweetAlert({ title, message, type, style: 'toast', position: 'top', autoDismiss: true, duration: 3000 });
  }, []);

  const success = useCallback((title: string, message?: string) => {
    showSweetAlert({ title, message, type: 'success', style: 'toast', position: 'top', autoDismiss: true, duration: 3000 });
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

  const confirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string
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

  return useMemo(() => ({
    sweetAlert, hideAlert, toast, success, error, warning, info, confirm, alert
  }), [sweetAlert, hideAlert, toast, success, error, warning, info, confirm, alert]);
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  toastTop: {
    top: Platform.OS === 'ios' ? 60 : 40,
  },
  toastCenter: {
    top: '40%',
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    minWidth: 300,
    maxWidth: SCREEN_W - 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    marginHorizontal: 20,
  },
  toastIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  toastTextContainer: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  toastMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  toastClose: {
    padding: 4,
    marginLeft: 8,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    width: Math.min(SCREEN_W - 48, 360),
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 20,
  },
  modalIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  modalMessage: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 4,
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

  liquidDot: {
    position: 'absolute',
    borderRadius: 999,
  },
});

export default SweetAlertProvider;
