// src/utils/StripeWrapper.tsx
import React from 'react';
import { Platform } from 'react-native';

// Only load Stripe on native platforms
let StripeProvider: React.FC<any> = ({ children }) => <>{children}</>;
let useStripe: any = () => ({ 
  initPaymentSheet: async () => {}, 
  presentPaymentSheet: async () => {},
  confirmPayment: async () => {},
  retrievePaymentIntent: async () => {},
});

if (Platform.OS !== 'web') {
  try {
    const stripe = require('@stripe/stripe-react-native');
    StripeProvider = stripe.StripeProvider || stripe.default?.StripeProvider;
    useStripe = stripe.useStripe || stripe.default?.useStripe;
  } catch (e) {
    console.warn('Stripe not available:', e);
  }
}

export { StripeProvider, useStripe };