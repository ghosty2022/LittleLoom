// Placeholder biometric module for Expo Go compatibility
// No native modules - returns false for all biometric functions

export interface BiometricResult {
  success: boolean;
  error?: string;
}

// Always returns false - biometric requires native modules
export const checkBiometricAvailability = async (): Promise<boolean> => {
  return false;
};

// Always returns failure - biometric requires native modules
export const authenticateWithBiometric = async (
  promptMessage: string = 'Authenticate'
): Promise<BiometricResult> => {
  return { 
    success: false, 
    error: 'Biometric authentication requires a development build. Not available in Expo Go.' 
  };
};

// Returns generic type since no native detection available
export const getBiometricType = async (): Promise<string> => {
  return 'Biometric';
};