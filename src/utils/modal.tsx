import React, { createContext, useContext, useCallback, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';

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
   EVENT BUS — pure pass-through to SweetAlert's bus
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
  const queue = pendingQueue.splice(0);
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

const emitHide = () => {
  pendingQueue.length = 0;
  hideListeners.forEach((listener) => listener());
};

/* ═══════════════════════════════════════════════════════════════════════════
   IMPERATIVE HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
export const showSuccessModal = (config: { title?: string; message: string }) =>
  emitShow({ type: 'success', title: config.title || 'Success', message: config.message, buttons: [{ text: 'Awesome!', style: 'default' }] });

export const showErrorModal = (config: { title?: string; message: string }) =>
  emitShow({ type: 'error', title: config.title || 'Error', message: config.message, buttons: [{ text: 'Got it', style: 'destructive' }] });

export const showConfirmModal = (config: { title?: string; message: string; onConfirm: () => void; onCancel?: () => void }) =>
  emitShow({
    type: 'confirm',
    title: config.title || 'Confirm',
    message: config.message,
    buttons: [
      { text: 'Cancel', style: 'cancel', onPress: config.onCancel },
      { text: 'Confirm', style: 'default', onPress: config.onConfirm },
    ],
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
   SHOW → SweetAlert BRIDGE
   ═══════════════════════════════════════════════════════════════════════════ */
const TYPE_MAP: Record<string, 'success' | 'error' | 'warning' | 'info' | 'question'> = {
  success: 'success',
  error: 'error',
  warning: 'warning',
  info: 'info',
  confirm: 'question',
  custom: 'info',
};

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'close-circle',
  warning: 'warning',
  confirm: 'help-circle',
  info: 'information-circle',
  custom: 'information-circle',
};

const dispatchToSweetAlert = (cfg: ModalConfig) => {
  let showSweetAlert: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    showSweetAlert = require('../components/SweetAlert').showSweetAlert;
  } catch {
    showSweetAlert = null;
  }

  if (!showSweetAlert) {
    if (__DEV__) console.warn('[ModalProvider] SweetAlert not mounted, dropping modal:', cfg.title);
    return;
  }

  const buttons = cfg.buttons || [];
  const primary =
    buttons.find((b) => b.style !== 'cancel' && b.style !== 'destructive') || buttons[0];
  const cancel = buttons.find((b) => b.style === 'cancel');
  const destructive = buttons.find((b) => b.style === 'destructive');

  const isConfirm = cfg.type === 'confirm' || buttons.length >= 2;
  const primaryBtn = destructive && !primary ? destructive : primary;

  const type: ModalType = cfg.type || 'info';

  showSweetAlert({
    title: cfg.title || 'Notification',
    message: cfg.message,
    type: TYPE_MAP[type] || 'info',
    style: 'modal',
    showCancel: isConfirm && !!cancel,
    showConfirm: !!primaryBtn,
    cancelText: cancel?.text,
    confirmText: primaryBtn?.text,
    destructive: primaryBtn?.style === 'destructive',
    icon: ICON_MAP[type] || 'information-circle',
    onConfirm: () => {
      primaryBtn?.onPress?.();
    },
    onCancel: () => {
      cancel?.onPress?.();
    },
    onDismiss: () => {
      cfg.onDismiss?.();
    },
  });
};

/* ═══════════════════════════════════════════════════════════════════════════
   PROVIDER
   ═══════════════════════════════════════════════════════════════════════════ */
export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Hide delegates to SweetAlert's own hide.
  const hide = useCallback(() => {
    let hideSweetAlert: any = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      hideSweetAlert = require('../components/SweetAlert').hideSweetAlert;
    } catch {}
    hideSweetAlert?.();
  }, []);

  // Register with the local bus. Uses `dispatchToSweetAlert` directly so
  // there is no `show` reference that could be stale or undefined.
  useEffect(() => {
    isProviderMounted = true;

    const handleShow: ModalListener = (newConfig) => {
      dispatchToSweetAlert(newConfig);
    };
    const handleHide: HideListener = () => {
      hide();
    };

    modalListeners.add(handleShow);
    hideListeners.add(handleHide);
    flushQueue();

    return () => {
      isProviderMounted = false;
      modalListeners.delete(handleShow);
      hideListeners.delete(handleHide);
    };
  }, [hide]);

  const value: ModalContextType = React.useMemo(
    () => ({
      show: (cfg: ModalConfig) => {
        // Imperative callers expect immediate display. Route through the
        // bus so it respects mount state, but skip the queue when possible.
        emitShow(cfg);
      },
      hide,
      isVisible: false, // kept for API compatibility; SweetAlert owns visibility
    }),
    [hide],
  );

  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
};

/* ═══════════════════════════════════════════════════════════════════════════
   DECLARATIVE BUILDER HELPERS (unchanged API)
   ═══════════════════════════════════════════════════════════════════════════ */
export const SweetAlert = {
  success: (title: string, message?: string, buttonText?: string) => ({
    type: 'success' as ModalType,
    title,
    message,
    buttons: [{ text: buttonText || 'Awesome!', style: 'default' as const }],
  }),
  error: (title: string, message?: string, buttonText?: string) => ({
    type: 'error' as ModalType,
    title,
    message,
    buttons: [{ text: buttonText || 'Got it', style: 'destructive' as const }],
  }),
  warning: (title: string, message?: string, buttonText?: string) => ({
    type: 'warning' as ModalType,
    title,
    message,
    buttons: [{ text: buttonText || 'Understood', style: 'default' as const }],
  }),
  info: (title: string, message?: string, buttonText?: string) => ({
    type: 'info' as ModalType,
    title,
    message,
    buttons: [{ text: buttonText || 'OK', style: 'default' as const }],
  }),
  confirm: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => ({
    type: 'confirm' as ModalType,
    title,
    message,
    buttons: [
      { text: 'Cancel', style: 'cancel' as const, onPress: onCancel },
      { text: 'Confirm', style: 'default' as const, onPress: onConfirm },
    ],
  }),
  delete: (title: string, message: string, onDelete: () => void, onCancel?: () => void) => ({
    type: 'error' as ModalType,
    title,
    message,
    buttons: [
      { text: 'Keep', style: 'cancel' as const, onPress: onCancel },
      { text: 'Delete', style: 'destructive' as const, onPress: onDelete },
    ],
  }),
};

export default ModalProvider;