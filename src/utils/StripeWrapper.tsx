// src/utils/StripeWrapper.tsx
import React from 'react';
import { Platform, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

// Only load Stripe on native platforms
let StripeProvider: React.FC<any> = ({ children }) => <>{children}</>;
let useStripe: any = () => ({ initPaymentSheet: async () => {}, presentPaymentSheet: async () => {} });

if (Platform.OS !== 'web') {
  try {
    const stripe = require('@stripe/stripe-react-native');
    StripeProvider = stripe.StripeProvider;
    useStripe = stripe.useStripe;
  } catch (e) {
    console.warn('Stripe not available:', e);
  }
}

export { StripeProvider, useStripe };