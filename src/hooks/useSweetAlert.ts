// src/hooks/useSweetAlert.ts
// WRAPPER: Convenience hook that auto-detects theme context
// Use this in screens instead of importing from components directly

import { useCallback } from 'react';
import { useCustomization } from './useCustomization';
import { showSweetAlert, SweetAlertConfig, AlertType } from '../components/SweetAlert';

export interface SweetAlertHook {
  showAlert: (config: SweetAlertConfig) => void;
  toast: (title: string, message?: string, type?: AlertType) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  confirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string
  ) => void;
  alert: (title: string, message?: string, type?: AlertType) => void;
}

export function useSweetAlert(): SweetAlertHook {
  const { isDark, themeColors, shouldReduceMotion } = useCustomization();

  const showAlert = useCallback((config: SweetAlertConfig) => {
    showSweetAlert({
      ...config,
      reduceMotion: config.reduceMotion ?? shouldReduceMotion,
    });
  }, [shouldReduceMotion]);

  const toast = useCallback((title: string, message?: string, type: AlertType = 'info') => {
    showAlert({
      title,
      message,
      type,
      style: 'toast',
      position: 'top',
      autoDismiss: true,
      duration: 3000,
    });
  }, [showAlert]);

  const success = useCallback((title: string, message?: string) => {
    showAlert({
      title,
      message,
      type: 'success',
      style: 'toast',
      position: 'top',
      autoDismiss: true,
      duration: 3000,
    });
  }, [showAlert]);

  const error = useCallback((title: string, message?: string) => {
    showAlert({
      title,
      message,
      type: 'error',
      style: 'toast',
      position: 'top',
      autoDismiss: true,
      duration: 4000,
    });
  }, [showAlert]);

  const warning = useCallback((title: string, message?: string) => {
    showAlert({
      title,
      message,
      type: 'warning',
      style: 'toast',
      position: 'top',
      autoDismiss: true,
      duration: 3500,
    });
  }, [showAlert]);

  const info = useCallback((title: string, message?: string) => {
    showAlert({
      title,
      message,
      type: 'info',
      style: 'toast',
      position: 'top',
      autoDismiss: true,
      duration: 3000,
    });
  }, [showAlert]);

  const confirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string
  ) => {
    showAlert({
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
  }, [showAlert]);

  const alert = useCallback((title: string, message?: string, type: AlertType = 'info') => {
    showAlert({
      title,
      message,
      type,
      style: 'modal',
      showConfirm: true,
      showCancel: false,
      confirmText: 'OK',
    });
  }, [showAlert]);

  return { showAlert, toast, success, error, warning, info, confirm, alert };
}

export default useSweetAlert;
