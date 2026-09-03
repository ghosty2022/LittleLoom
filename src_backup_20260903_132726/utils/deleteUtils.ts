// src/utils/deleteUtils.ts
import { Alert } from 'react-native';

export interface DeleteConfirmationOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  requirePassword?: boolean;
  onConfirm: (password?: string) => Promise<void> | void;
  onCancel?: () => void;
}

export const confirmDelete = (options: DeleteConfirmationOptions) => {
  const {
    title,
    message,
    confirmText = 'Delete',
    cancelText = 'Cancel',
    requirePassword = true,
    onConfirm,
    onCancel,
  } = options;

  Alert.alert(
    title,
    message,
    [
      {
        text: cancelText,
        style: 'cancel',
        onPress: onCancel,
      },
      {
        text: confirmText,
        style: 'destructive',
        onPress: () => {
          if (requirePassword) {
            Alert.prompt(
              'Confirm Password',
              'Enter your password to confirm this action:',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: onCancel,
                },
                {
                  text: confirmText,
                  style: 'destructive',
                  onPress: async (password) => {
                    if (!password) {
                      Alert.alert('Error', 'Password is required');
                      return;
                    }
                    await onConfirm(password);
                  },
                },
              ],
              'secure-text'
            );
          } else {
            onConfirm();
          }
        },
      },
    ],
    { cancelable: false }
  );
};

// Simplified version for baby deletion
export const confirmDeleteBaby = (
  babyName: string,
  onConfirm: (password: string) => Promise<void>,
  onCancel?: () => void
) => {
  confirmDelete({
    title: `Delete ${babyName}?`,
    message: `⚠️ This will permanently delete ${babyName}'s profile and all associated data. This action cannot be undone.`,
    confirmText: 'Delete',
    requirePassword: true,
    onConfirm: onConfirm,
    onCancel: onCancel,
  });
};

// Simplified version for member deletion
export const confirmDeleteMember = (
  memberName: string,
  onConfirm: (password: string) => Promise<void>,
  onCancel?: () => void
) => {
  confirmDelete({
    title: `Remove ${memberName}?`,
    message: `Remove ${memberName} from the family? Their history will be preserved but they will lose access.`,
    confirmText: 'Remove',
    requirePassword: true,
    onConfirm: onConfirm,
    onCancel: onCancel,
  });
};

// Simplified version for account deletion
export const confirmDeleteAccount = (
  onConfirm: (password: string) => Promise<void>,
  onCancel?: () => void
) => {
  confirmDelete({
    title: 'Delete Account',
    message: '⚠️ This will permanently delete your account and all associated data. This action cannot be undone.',
    confirmText: 'Delete',
    requirePassword: true,
    onConfirm: onConfirm,
    onCancel: onCancel,
  });
};