import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  useColorScheme,
  StatusBar,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Aura
   ═══════════════════════════════════════════════════════════════════════════ */
const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  accent: '#ec4899',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0ea5e9',
  danger: '#ef4444',
  white: '#ffffff',
  gray100: '#f5f5f4',
  gray300: '#d6d3d1',
  gray400: '#a8a29e',
  gray500: '#78716c',
  gray600: '#57534e',
  gray900: '#1c1917',
  darkCard: '#292524',
  darkBorder: 'rgba(255,255,255,0.08)',
  radius: { md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  shadow: { lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.18, shadowRadius: 48, elevation: 24 } },
};

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */
export type ModalType = 'info' | 'success' | 'warning' | 'error' | 'confirm' | 'custom';

export interface ModalButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
  icon?: keyof typeof Ionicons.glyphMap;
}

export interface ModalConfig {
  title?: string;
  message?: string;
  type?: ModalType;
  buttons?: ModalButton[];
  customContent?: React.ReactNode;
  onDismiss?: () => void;
  showCloseButton?: boolean;
  animationType?: 'fade' | 'slide' | 'zoom';
}

interface ModalContextType {
  show: (config: ModalConfig) => void;
  hide: () => void;
  isVisible: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   EVENT BUS
   ═══════════════════════════════════════════════════════════════════════════ */
type ModalListener = (config: ModalConfig) => void;
type HideListener = () => void;

const modalListeners: Set<ModalListener> = new Set();
const hideListeners: Set<HideListener> = new Set();
const pendingQueue: ModalConfig[] = [];
const MAX_QUEUE_SIZE = 20;
let isProviderMounted = false;

const flushQueue = () => {
  if (!isProviderMounted || pendingQueue.length === 0) return;
  const queue = [...pendingQueue];
  pendingQueue.length = 0;
  queue.forEach((config) => {
    modalListeners.forEach((listener) => listener(config));
  });
};

const emitShow = (config: ModalConfig) => {
  if (!isProviderMounted) {
    if (pendingQueue.length < MAX_QUEUE_SIZE) pendingQueue.push(config);
    return;
  }
  modalListeners.forEach((listener) => listener(config));
};

const emitHide = () => { hideListeners.forEach((listener) => listener()); };

/* ═══════════════════════════════════════════════════════════════════════════
   IMPERATIVE HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
export const showSuccessModal = (config: { title?: string; message: string }) =>
  emitShow({ type: 'success', title: config.title || 'Success', message: config.message, buttons: [{ text: 'Awesome!', style: 'default' }] });

export const showErrorModal = (config: { title?: string; message: string }) =>
  emitShow({ type: 'error', title: config.title || 'Error', message: config.message, buttons: [{ text: 'Got it', style: 'destructive' }] });

export const showConfirmModal = (config: { title?: string; message: string; onConfirm: () => void; onCancel?: () => void }) =>
  emitShow({
    type: 'confirm', title: config.title || 'Confirm', message: config.message,
    buttons: [{ text: 'Cancel', style: 'cancel', onPress: config.onCancel }, { text: 'Confirm', style: 'default', onPress: config.onConfirm }],
  });

export const showWarningModal = (config: { title?: string; message: string }) =>
  emitShow({ type: 'warning', title: config.title || 'Warning', message: config.message, buttons: [{ text: 'Understood', style: 'default' }] });

export const showInfoModal = (config: { title?: string; message: string }) =>
  emitShow({ type: 'info', title: config.title || 'Info', message: config.message, buttons: [{ text: 'OK', style: 'default' }] });

export const showModal = (config: ModalConfig) => emitShow(config);
export const hideModal = () => emitHide();

/* ═══════════════════════════════════════════════════════════════════════════
   CONTEXT
   ═══════════════════════════════════════════════════════════════════════════ */
const ModalContext = createContext<ModalContextType | null>(null);

export const useModal = () => {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within ModalProvider');
  return ctx;
};

/* ═══════════════════════════════════════════════════════════════════════════
   PROVIDER
   ═══════════════════════════════════════════════════════════════════════════ */
export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [config, setConfig] = useState<ModalConfig>({});
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const hideCalledRef = useRef(false);

  const show = useCallback((newConfig: ModalConfig) => {
    hideCalledRef.current = false;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setConfig(newConfig);
    setIsVisible(true);
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.85);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const hide = useCallback(() => {
    if (hideCalledRef.current) return;
    hideCalledRef.current = true;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.85, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setIsVisible(false);
      setConfig((prev) => { prev.onDismiss?.(); return {}; });
    });
  }, [fadeAnim, scaleAnim]);

  useEffect(() => {
    isProviderMounted = true;
    const handleShow: ModalListener = (newConfig) => show(newConfig);
    const handleHide: HideListener = () => hide();
    modalListeners.add(handleShow);
    hideListeners.add(handleHide);
    flushQueue();
    return () => {
      isProviderMounted = false;
      modalListeners.delete(handleShow);
      hideListeners.delete(handleHide);
    };
  }, [show, hide]);

  const getIconForType = (type: ModalType) => {
    switch (type) {
      case 'success': return { icon: 'checkmark-circle' as const, color: DS.success, bg: `${DS.success}15` };
      case 'error': return { icon: 'close-circle' as const, color: DS.danger, bg: `${DS.danger}15` };
      case 'warning': return { icon: 'warning' as const, color: DS.warning, bg: `${DS.warning}15` };
      case 'confirm': return { icon: 'help-circle' as const, color: DS.accent, bg: `${DS.accent}15` };
      default: return { icon: 'information-circle' as const, color: DS.primary, bg: `${DS.primary}15` };
    }
  };

  const getButtonGradient = (style?: string): [string, string] => {
    switch (style) {
      case 'destructive': return [DS.danger, '#f87171'];
      case 'cancel': return isDark ? ['#3a3a3a', '#4a4a4a'] : [DS.gray100, DS.gray300];
      default: return [DS.primary, DS.accent];
    }
  };

  const getButtonTextColor = (style?: string) => {
    if (style === 'cancel' && !isDark) return DS.gray600;
    return DS.white;
  };

  const handleButtonPress = (button: ModalButton) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    button.onPress?.();
    hide();
  };

  const iconConfig = getIconForType(config.type || 'info');

  return (
    <ModalContext.Provider value={{ show, hide, isVisible }}>
      {children}
      <Modal visible={isVisible} transparent animationType="none" onRequestClose={hide} statusBarTranslucent>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <BlurView intensity={isDark ? 80 : 90} style={styles.blurView} tint={isDark ? 'dark' : 'light'}>
            <TouchableOpacity style={styles.backdrop} onPress={hide} activeOpacity={1} />
            <Animated.View style={[styles.modalContainer, { transform: [{ scale: scaleAnim }] }, isDark && styles.modalContainerDark]}>
              <LinearGradient
                colors={isDark ? [`${iconConfig.color}30`, 'transparent'] : [`${iconConfig.color}15`, 'transparent']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              />
              {config.showCloseButton && (
                <TouchableOpacity style={[styles.closeButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : DS.gray100 }]} onPress={hide}>
                  <Ionicons name="close" size={18} color={isDark ? DS.white : DS.gray900} />
                </TouchableOpacity>
              )}

              {!config.customContent && (
                <View style={[styles.iconContainer, { backgroundColor: iconConfig.bg }]}>
                  <LinearGradient colors={[iconConfig.color, `${iconConfig.color}cc`]} style={styles.iconGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Ionicons name={iconConfig.icon} size={30} color={DS.white} />
                  </LinearGradient>
                </View>
              )}

              {config.customContent ? config.customContent : (
                <>
                  <Text style={[styles.title, { color: isDark ? DS.white : DS.gray900 }]}>{config.title || 'Notification'}</Text>
                  {config.message && (
                    <Text style={[styles.message, { color: isDark ? DS.gray400 : DS.gray500 }]}>{config.message}</Text>
                  )}
                </>
              )}

              {config.buttons && config.buttons.length > 0 && (
                <View style={styles.buttonContainer}>
                  {config.buttons.map((button, index) => (
                    <TouchableOpacity key={index} style={[styles.button, index > 0 && styles.buttonMargin]} onPress={() => handleButtonPress(button)} activeOpacity={0.85}>
                      <LinearGradient colors={getButtonGradient(button.style)} style={styles.buttonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        {button.icon && <Ionicons name={button.icon} size={16} color={getButtonTextColor(button.style)} style={{ marginRight: 6 }} />}
                        <Text style={[styles.buttonText, { color: getButtonTextColor(button.style) }]}>{button.text}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </Animated.View>
          </BlurView>
        </Animated.View>
      </Modal>
    </ModalContext.Provider>
  );
};

export const SweetAlert = {
  success: (title: string, message?: string, buttonText?: string) => ({ type: 'success' as ModalType, title, message, buttons: [{ text: buttonText || 'Awesome!', style: 'default' as const }] }),
  error: (title: string, message?: string, buttonText?: string) => ({ type: 'error' as ModalType, title, message, buttons: [{ text: buttonText || 'Got it', style: 'destructive' as const }] }),
  warning: (title: string, message?: string, buttonText?: string) => ({ type: 'warning' as ModalType, title, message, buttons: [{ text: buttonText || 'Understood', style: 'default' as const }] }),
  info: (title: string, message?: string, buttonText?: string) => ({ type: 'info' as ModalType, title, message, buttons: [{ text: buttonText || 'OK', style: 'default' as const }] }),
  confirm: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => ({
    type: 'confirm' as ModalType, title, message,
    buttons: [{ text: 'Cancel', style: 'cancel' as const, onPress: onCancel }, { text: 'Confirm', style: 'default' as const, onPress: onConfirm }],
  }),
  delete: (title: string, message: string, onDelete: () => void, onCancel?: () => void) => ({
    type: 'error' as ModalType, title, message,
    buttons: [{ text: 'Keep', style: 'cancel' as const, onPress: onCancel }, { text: 'Delete', style: 'destructive' as const, onPress: onDelete }],
  }),
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  blurView: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  modalContainer: {
    width: SCREEN_WIDTH - 48, maxWidth: 360,
    backgroundColor: DS.white, borderRadius: DS.radius['2xl'],
    padding: 24, alignItems: 'center',
    ...DS.shadow.lg, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)', overflow: 'hidden',
  },
  modalContainerDark: { backgroundColor: DS.darkCard, borderColor: DS.darkBorder },
  closeButton: { position: 'absolute', top: 14, right: 14, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  iconContainer: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16, overflow: 'hidden' },
  iconGradient: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 8, letterSpacing: -0.3 },
  message: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 20, fontWeight: '500' },
  buttonContainer: { flexDirection: 'row', width: '100%', gap: 10 },
  button: { flex: 1, borderRadius: DS.radius.md, overflow: 'hidden' },
  buttonMargin: {},
  buttonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, paddingHorizontal: 16 },
  buttonText: { fontSize: 14, fontWeight: '800' },
});

export default ModalProvider;