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
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

type ModalListener = (config: ModalConfig) => void;
type HideListener = () => void;

const modalListeners: Set<ModalListener> = new Set();
const hideListeners: Set<HideListener> = new Set();
const pendingQueue: ModalConfig[] = [];
let isProviderMounted = false;

const flushQueue = () => {
  if (!isProviderMounted || pendingQueue.length === 0) return;
  const queue = [...pendingQueue];
  pendingQueue.length = 0;
  queue.forEach(config => {
    modalListeners.forEach(listener => listener(config));
  });
};

const emitShow = (config: ModalConfig) => {
  if (!isProviderMounted) {
    pendingQueue.push(config);
    return;
  }
  modalListeners.forEach(listener => listener(config));
};

const emitHide = () => {
  hideListeners.forEach(listener => listener());
};

export const showSuccessModal = (config: { title?: string; message: string }) => {
  emitShow({
    type: 'success',
    title: config.title || 'Success',
    message: config.message,
    buttons: [{ text: 'Awesome!', style: 'default' }],
  });
};

export const showErrorModal = (config: { title?: string; message: string }) => {
  emitShow({
    type: 'error',
    title: config.title || 'Error',
    message: config.message,
    buttons: [{ text: 'Got it', style: 'destructive' }],
  });
};

export const showConfirmModal = (config: { title?: string; message: string; onConfirm: () => void; onCancel?: () => void }) => {
  emitShow({
    type: 'confirm',
    title: config.title || 'Confirm',
    message: config.message,
    buttons: [
      { text: 'Cancel', style: 'cancel', onPress: config.onCancel },
      { text: 'Confirm', style: 'default', onPress: config.onConfirm },
    ],
  });
};

export const showWarningModal = (config: { title?: string; message: string }) => {
  emitShow({
    type: 'warning',
    title: config.title || 'Warning',
    message: config.message,
    buttons: [{ text: 'Understood', style: 'default' }],
  });
};

export const showInfoModal = (config: { title?: string; message: string }) => {
  emitShow({
    type: 'info',
    title: config.title || 'Info',
    message: config.message,
    buttons: [{ text: 'OK', style: 'default' }],
  });
};

export const showModal = (config: ModalConfig) => {
  emitShow(config);
};

export const hideModal = () => {
  emitHide();
};

const ModalContext = createContext<ModalContextType | null>(null);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within ModalProvider');
  }
  return context;
};

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [config, setConfig] = useState<ModalConfig>({});
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const show = useCallback((newConfig: ModalConfig) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setConfig(newConfig);
    setIsVisible(true);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsVisible(false);
      config.onDismiss?.();
    });
  }, [fadeAnim, scaleAnim, config]);

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
      case 'success': return { icon: 'checkmark-circle' as const, color: '#43e97b', bg: 'rgba(67,233,123,0.15)' };
      case 'error': return { icon: 'close-circle' as const, color: '#ff4757', bg: 'rgba(255,71,87,0.15)' };
      case 'warning': return { icon: 'warning' as const, color: '#ffa502', bg: 'rgba(255,165,2,0.15)' };
      case 'info': return { icon: 'information-circle' as const, color: '#667eea', bg: 'rgba(102,126,234,0.15)' };
      case 'confirm': return { icon: 'help-circle' as const, color: '#fa709a', bg: 'rgba(250,112,154,0.15)' };
      default: return { icon: 'information-circle' as const, color: '#667eea', bg: 'rgba(102,126,234,0.15)' };
    }
  };

  const getButtonGradient = (style?: string) => {
    switch (style) {
      case 'destructive': return ['#ff4757', '#ff6b6b'] as [string, string];
      case 'cancel': return isDark ? ['#333', '#444'] as [string, string] : ['#e2e8f0', '#cbd5e1'] as [string, string];
      default: return ['#667eea', '#764ba2'] as [string, string];
    }
  };

  const getButtonTextColor = (style?: string) => {
    if (style === 'cancel' && !isDark) return '#64748b';
    return '#ffffff';
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
      <Modal
        visible={isVisible}
        transparent
        animationType="none"
        onRequestClose={hide}
        statusBarTranslucent
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <BlurView intensity={isDark ? 80 : 90} style={styles.blurView} tint={isDark ? 'dark' : 'light'}>
            <TouchableOpacity style={styles.backdrop} onPress={hide} activeOpacity={1} />

            <Animated.View 
              style={[
                styles.modalContainer,
                { transform: [{ scale: scaleAnim }] },
                isDark && styles.modalContainerDark
              ]}
            >
              {config.showCloseButton && (
                <TouchableOpacity style={styles.closeButton} onPress={hide}>
                  <Ionicons name="close" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
                </TouchableOpacity>
              )}

              {!config.customContent && (
                <View style={[styles.iconContainer, { backgroundColor: iconConfig.bg }]}>
                  <Ionicons name={iconConfig.icon} size={40} color={iconConfig.color} />
                </View>
              )}

              {config.customContent ? (
                config.customContent
              ) : (
                <>
                  <Text style={[styles.title, isDark && styles.titleDark]}>
                    {config.title || 'Notification'}
                  </Text>
                  <Text style={[styles.message, isDark && styles.messageDark]}>
                    {config.message}
                  </Text>
                </>
              )}

              {config.buttons && config.buttons.length > 0 && (
                <View style={styles.buttonContainer}>
                  {config.buttons.map((button, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.button, index > 0 && styles.buttonMargin]}
                      onPress={() => handleButtonPress(button)}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={getButtonGradient(button.style)}
                        style={styles.buttonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        {button.icon && (
                          <Ionicons 
                            name={button.icon} 
                            size={18} 
                            color={getButtonTextColor(button.style)} 
                            style={styles.buttonIcon}
                          />
                        )}
                        <Text style={[styles.buttonText, { color: getButtonTextColor(button.style) }]}>
                          {button.text}
                        </Text>
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
  success: (title: string, message?: string, buttonText?: string) => {
    return {
      type: 'success' as ModalType,
      title,
      message,
      buttons: [{ text: buttonText || 'Awesome!', style: 'default' as const }],
    };
  },
  error: (title: string, message?: string, buttonText?: string) => {
    return {
      type: 'error' as ModalType,
      title,
      message,
      buttons: [{ text: buttonText || 'Got it', style: 'destructive' as const }],
    };
  },
  warning: (title: string, message?: string, buttonText?: string) => {
    return {
      type: 'warning' as ModalType,
      title,
      message,
      buttons: [{ text: buttonText || 'Understood', style: 'default' as const }],
    };
  },
  info: (title: string, message?: string, buttonText?: string) => {
    return {
      type: 'info' as ModalType,
      title,
      message,
      buttons: [{ text: buttonText || 'OK', style: 'default' as const }],
    };
  },
  confirm: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => {
    return {
      type: 'confirm' as ModalType,
      title,
      message,
      buttons: [
        { text: 'Cancel', style: 'cancel' as const, onPress: onCancel },
        { text: 'Confirm', style: 'default' as const, onPress: onConfirm },
      ],
    };
  },
  delete: (title: string, message: string, onDelete: () => void, onCancel?: () => void) => {
    return {
      type: 'error' as ModalType,
      title,
      message,
      buttons: [
        { text: 'Keep', style: 'cancel' as const, onPress: onCancel },
        { text: 'Delete', style: 'destructive' as const, onPress: onDelete },
      ],
    };
  },
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  blurView: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    width: SCREEN_WIDTH - 48,
    maxWidth: 340,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  modalContainerDark: {
    backgroundColor: 'rgba(30,30,30,0.95)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  titleDark: {
    color: '#ffffff',
  },
  message: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  messageDark: {
    color: '#a0a0a0',
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  buttonMargin: {
    marginLeft: 0,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});

export default ModalProvider;
