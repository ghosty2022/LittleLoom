/**
 * LittleLoom Alert Utility
 * Cross-platform alert helper that works with React Native's Alert
 * and provides a consistent API across the app.
 */

import { Alert, Platform } from 'react-native';

export type AlertButtonStyle = 'default' | 'cancel' | 'destructive';

export interface AlertButton {
  text: string;
  style?: AlertButtonStyle;
  onPress?: () => void;
}

/**
 * Show a cross-platform alert dialog.
 * 
 * On native: Uses React Native's Alert API
 * On web: Falls back to browser alert/confirm
 * 
 * @param title - Alert title
 * @param message - Alert message body
 * @param buttons - Array of button configurations (optional)
 */
export const showAlert = (
  title: string,
  message?: string,
  buttons?: AlertButton[]
): void => {
  // If no buttons provided, show a simple OK alert
  if (!buttons || buttons.length === 0) {
    if (Platform.OS === 'web') {
      window.alert(`${title}${message ? `\n\n${message}` : ''}`);
    } else {
      Alert.alert(title, message);
    }
    return;
  }

  // Map our button style to React Native's Alert button style
  const mappedButtons = buttons.map((btn) => ({
    text: btn.text,
    style: btn.style as 'default' | 'cancel' | 'destructive' | undefined,
    onPress: btn.onPress,
  }));

  if (Platform.OS === 'web') {
    // On web, use confirm for 2-button dialogs, alert for single button
    if (mappedButtons.length === 2) {
      const confirmed = window.confirm(`${title}\n\n${message || ''}`);
      if (confirmed) {
        mappedButtons[1]?.onPress?.();
      } else {
        mappedButtons[0]?.onPress?.();
      }
    } else {
      window.alert(`${title}${message ? `\n\n${message}` : ''}`);
      mappedButtons[mappedButtons.length - 1]?.onPress?.();
    }
  } else {
    Alert.alert(title, message, mappedButtons);
  }
};

/**
 * Show a confirmation dialog with OK/Cancel buttons.
 * 
 * @param title - Alert title
 * @param message - Alert message
 * @param onConfirm - Callback when user presses OK
 * @param onCancel - Callback when user presses Cancel (optional)
 */
export const showConfirm = (
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
): void => {
  showAlert(title, message, [
    {
      text: 'Cancel',
      style: 'cancel',
      onPress: onCancel,
    },
    {
      text: 'OK',
      style: 'default',
      onPress: onConfirm,
    },
  ]);
};

/**
 * Show a destructive confirmation dialog (e.g., delete).
 * 
 * @param title - Alert title
 * @param message - Alert message
 * @param onDelete - Callback when user confirms deletion
 * @param onCancel - Callback when user cancels (optional)
 */
export const showDestructiveConfirm = (
  title: string,
  message: string,
  onDelete: () => void,
  onCancel?: () => void
): void => {
  showAlert(title, message, [
    {
      text: 'Cancel',
      style: 'cancel',
      onPress: onCancel,
    },
    {
      text: 'Delete',
      style: 'destructive',
      onPress: onDelete,
    },
  ]);
};

/**
 * Show an error alert.
 * 
 * @param message - Error message
 * @param title - Optional custom title (defaults to "Error")
 */
export const showError = (message: string, title: string = 'Error'): void => {
  showAlert(title, message, [{ text: 'OK', style: 'default' }]);
};

/**
 * Show a success alert.
 * 
 * @param message - Success message
 * @param title - Optional custom title (defaults to "Success")
 */
export const showSuccess = (message: string, title: string = 'Success'): void => {
  showAlert(title, message, [{ text: 'OK', style: 'default' }]);
};

/**
 * Show a warning alert.
 * 
 * @param message - Warning message
 * @param title - Optional custom title (defaults to "Warning")
 */
export const showWarning = (message: string, title: string = 'Warning'): void => {
  showAlert(title, message, [{ text: 'OK', style: 'default' }]);
};

export default showAlert;