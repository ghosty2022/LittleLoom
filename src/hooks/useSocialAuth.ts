import { useCallback, useState } from 'react';
import { showAlert } from '@/utils/alert';

export interface SocialUser {
  id: string;
  fullName: string;
  email: string;
  avatar?: string;
  provider: 'google' | 'apple' | 'facebook';
}

export interface SocialAuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  socialUser: SocialUser | null;
  error: string | null;
}

export const useSocialAuth = () => {
  const [state, setState] = useState<SocialAuthState>({
    isLoading: false,
    isAuthenticated: false,
    socialUser: null,
    error: null,
  });

  const signInWithGoogle = useCallback(async (): Promise<SocialUser | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const mockUser: SocialUser = {
        id: `google_${Date.now()}`,
        fullName: 'Google User',
        email: 'user@gmail.com',
        avatar: 'https://via.placeholder.com/100',
        provider: 'google',
      };
      setState({ isLoading: false, isAuthenticated: true, socialUser: mockUser, error: null });
      return mockUser;
    } catch (error: any) {
      const message = error?.message || 'Google sign-in failed';
      setState(prev => ({ ...prev, isLoading: false, error: message }));

showAlert('Sign In Error', message);
      return null;
    }
  }, []);

  const signInWithApple = useCallback(async (): Promise<SocialUser | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const mockUser: SocialUser = {
        id: `apple_${Date.now()}`,
        fullName: 'Apple User',
        email: 'user@icloud.com',
        provider: 'apple',
      };
      setState({ isLoading: false, isAuthenticated: true, socialUser: mockUser, error: null });
      return mockUser;
    } catch (error: any) {
      const message = error?.message || 'Apple sign-in failed';
      setState(prev => ({ ...prev, isLoading: false, error: message }));

showAlert('Sign In Error', message);
      return null;
    }
  }, []);

  const signInWithFacebook = useCallback(async (): Promise<SocialUser | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const mockUser: SocialUser = {
        id: `facebook_${Date.now()}`,
        fullName: 'Facebook User',
        email: 'user@facebook.com',
        avatar: 'https://via.placeholder.com/100',
        provider: 'facebook',
      };
      setState({ isLoading: false, isAuthenticated: true, socialUser: mockUser, error: null });
      return mockUser;
    } catch (error: any) {
      const message = error?.message || 'Facebook sign-in failed';
      setState(prev => ({ ...prev, isLoading: false, error: message }));

showAlert('Sign In Error', message);
      return null;
    }
  }, []);

  const signOut = useCallback(() => {
    setState({
      isLoading: false,
      isAuthenticated: false,
      socialUser: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    signInWithGoogle,
    signInWithApple,
    signInWithFacebook,
    signOut,
  };
};

export default useSocialAuth;
