import { useCallback } from 'react';
import { useCustomization } from './useCustomization';
import { showSweetAlert, SweetAlertConfig, AlertType } from '../components/SweetAlert';

export interface SweetAlertHook {
  sweetAlert: (config: SweetAlertConfig) => void;
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

  const sweetAlert = useCallback((config: SweetAlertConfig) => {
    showSweetAlert({
      ...config,
      reduceMotion: config.reduceMotion ?? shouldReduceMotion,
    });
  }, [shouldReduceMotion]);

  const toast = useCallback((title: string, message?: string, type: AlertType = 'info') => {
    sweetAlert({
      title,
      message,
      type,
      style: 'toast',
      position: 'top',
      autoDismiss: true,
      duration: 3000,
    });
  }, [sweetAlert]);

  const success = useCallback((title: string, message?: string) => {
    sweetAlert({
      title,
      message,
      type: 'success',
      style: 'toast',
      position: 'top',
      autoDismiss: true,
      duration: 3000,
    });
  }, [sweetAlert]);

  const error = useCallback((title: string, message?: string) => {
    sweetAlert({
      title,
      message,
      type: 'error',
      style: 'toast',
      position: 'top',
      autoDismiss: true,
      duration: 4000,
    });
  }, [sweetAlert]);

  const warning = useCallback((title: string, message?: string) => {
    sweetAlert({
      title,
      message,
      type: 'warning',
      style: 'toast',
      position: 'top',
      autoDismiss: true,
      duration: 3500,
    });
  }, [sweetAlert]);

  const info = useCallback((title: string, message?: string) => {
    sweetAlert({
      title,
      message,
      type: 'info',
      style: 'toast',
      position: 'top',
      autoDismiss: true,
      duration: 3000,
    });
  }, [sweetAlert]);

  const confirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string
  ) => {
    sweetAlert({
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
  }, [sweetAlert]);

  const alert = useCallback((title: string, message?: string, type: AlertType = 'info') => {
    sweetAlert({
      title,
      message,
      type,
      style: 'modal',
      showConfirm: true,
      showCancel: false,
      confirmText: 'OK',
    });
  }, [sweetAlert]);

  return { sweetAlert, toast, success, error, warning, info, confirm, alert };
}

export default useSweetAlert;
