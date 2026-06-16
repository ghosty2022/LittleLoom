import { Alert } from 'react-native';

/**
 * Simple cross-platform alert utility.
 * Falls back to React Native's Alert API.
 * 
 * Usage:
 *   showAlert('Title', 'Message');
 *   showAlert('Title', 'Message', [
 *     { text: 'Cancel', style: 'cancel' },
 *     { text: 'OK', onPress: () => doSomething() }
 *   ]);
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: Array<{
    text?: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>
): void {
  // Default OK button if none provided
  const alertButtons = buttons && buttons.length > 0
    ? buttons
    : [{ text: 'OK', style: 'default' as const }];

  Alert.alert(title, message, alertButtons);
}

/**
 * Confirmation dialog helper
 */
export function showConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void,
  confirmText: string = 'OK',
  cancelText: string = 'Cancel'
): void {
  Alert.alert(title, message, [
    {
      text: cancelText,
      style: 'cancel',
      onPress: onCancel,
    },
    {
      text: confirmText,
      style: 'default',
      onPress: onConfirm,
    },
  ]);
}