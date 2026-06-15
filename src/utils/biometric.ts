export interface BiometricResult {
  success: boolean;
  error?: string;
}

export const checkBiometricAvailability = async (): Promise<boolean> => {
  return false;
};

export const authenticateWithBiometric = async (
  promptMessage: string = 'Authenticate'
): Promise<BiometricResult> => {
  return { 
    success: false, 
    error: 'Biometric authentication requires a development build. Not available in Expo Go.' 
  };
};

export const getBiometricType = async (): Promise<string> => {
  return 'Biometric';
};
