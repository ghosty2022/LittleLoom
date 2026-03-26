// src/utils/modal.tsx
// Universal Modal System for LittleLoom - Glassmorphism Design
// Usage: import { showModal, hideModal, ModalProvider } from '../utils/modal';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ==================== TYPES ====================

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

// ==================== CONTEXT ====================

const ModalContext = createContext<ModalContextType | null>(null);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within ModalProvider');
  }
  return context;
};

// ==================== MODAL PROVIDER ====================

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [config, setConfig] = useState<ModalConfig>({});
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const show = useCallback((newConfig: ModalConfig) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  const getIconForType = (type: ModalType) => {
    switch (type) {
      case 'success': return { icon: 'checkmark-circle', color: '#43e97b', bg: 'rgba(67,233,123,0.15)' };
      case 'error': return { icon: 'close-circle', color: '#ff4757', bg: 'rgba(255,71,87,0.15)' };
      case 'warning': return { icon: 'warning', color: '#ffa502', bg: 'rgba(255,165,2,0.15)' };
      case 'info': return { icon: 'information-circle', color: '#667eea', bg: 'rgba(102,126,234,0.15)' };
      case 'confirm': return { icon: 'help-circle', color: '#fa709a', bg: 'rgba(250,112,154,0.15)' };
      default: return { icon: 'information-circle', color: '#667eea', bg: 'rgba(102,126,234,0.15)' };
    }
  };

  const getButtonGradient = (style?: string) => {
    switch (style) {
      case 'destructive': return ['#ff4757', '#ff6b6b'];
      case 'cancel': return isDark ? ['#333', '#444'] : ['#e2e8f0', '#cbd5e1'];
      default: return ['#667eea', '#764ba2'];
    }
  };

  const getButtonTextColor = (style?: string) => {
    if (style === 'cancel' && !isDark) return '#64748b';
    return '#ffffff';
  };

  const handleButtonPress = (button: ModalButton) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
              {/* Close Button */}
              {config.showCloseButton && (
                <TouchableOpacity style={styles.closeButton} onPress={hide}>
                  <Ionicons name="close" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
                </TouchableOpacity>
              )}

              {/* Icon */}
              {!config.customContent && (
                <View style={[styles.iconContainer, { backgroundColor: iconConfig.bg }]}>
                  <Ionicons name={iconConfig.icon as any} size={40} color={iconConfig.color} />
                </View>
              )}

              {/* Content */}
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

              {/* Buttons */}
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
                        colors={getButtonGradient(button.style) as [string, string]}
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

// ==================== CONVENIENCE FUNCTIONS ====================

export const showModal = (config: ModalConfig) => {
  // This will be called after ModalProvider is set up
  console.warn('showModal called before ModalProvider is ready. Use useModal hook instead.');
};

export const hideModal = () => {
  console.warn('hideModal called before ModalProvider is ready. Use useModal hook instead.');
};

// ==================== SWEET ALERT STYLE FUNCTIONS ====================

export const SweetAlert = {
  success: (title: string, message?: string, buttonText?: string) => {
    return {
      type: 'success' as ModalType,
      title,
      message,
      buttons: [{ text: buttonText || 'Awesome!', style: 'default' }],
    };
  },
  error: (title: string, message?: string, buttonText?: string) => {
    return {
      type: 'error' as ModalType,
      title,
      message,
      buttons: [{ text: buttonText || 'Got it', style: 'destructive' }],
    };
  },
  warning: (title: string, message?: string, buttonText?: string) => {
    return {
      type: 'warning' as ModalType,
      title,
      message,
      buttons: [{ text: buttonText || 'Understood', style: 'default' }],
    };
  },
  info: (title: string, message?: string, buttonText?: string) => {
    return {
      type: 'info' as ModalType,
      title,
      message,
      buttons: [{ text: buttonText || 'OK', style: 'default' }],
    };
  },
  confirm: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => {
    return {
      type: 'confirm' as ModalType,
      title,
      message,
      buttons: [
        { text: 'Cancel', style: 'cancel', onPress: onCancel },
        { text: 'Confirm', style: 'default', onPress: onConfirm },
      ],
    };
  },
  delete: (title: string, message: string, onDelete: () => void, onCancel?: () => void) => {
    return {
      type: 'error' as ModalType,
      title,
      message,
      buttons: [
        { text: 'Keep', style: 'cancel', onPress: onCancel },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ],
    };
  },
};

// ==================== STYLES ====================

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