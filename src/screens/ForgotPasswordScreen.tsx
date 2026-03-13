import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

export default function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }
    
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSent(true);
    }, 1500);
  };

  return (
    <LinearGradient colors={['#e0e7ff', '#d1d5ff', '#c7b8ff']} style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color="#1a1a1a" />
          </TouchableOpacity>

          {!sent ? (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Reset Password 🔐</Text>
                <Text style={styles.subtitle}>
                  Enter your email address and we'll send you instructions to reset your password
                </Text>
              </View>

              <BlurView intensity={90} style={styles.formContainer}>
                <View style={styles.iconContainer}>
                  <Text style={styles.lockEmoji}>🔒</Text>
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={24} color="#667eea" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email address"
                    placeholderTextColor="#999"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <TouchableOpacity style={styles.resetButton} onPress={handleReset} disabled={loading}>
                  <LinearGradient colors={['#667eea', '#764ba2']} style={styles.resetGradient}>
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.resetText}>Send Reset Link</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </BlurView>
            </>
          ) : (
            <BlurView intensity={90} style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Text style={styles.successEmoji}>📧</Text>
              </View>
              <Text style={styles.successTitle}>Check Your Email!</Text>
              <Text style={styles.successText}>
                We've sent password reset instructions to {email}
              </Text>
              <TouchableOpacity 
                style={styles.backToLogin}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.backToLoginText}>Back to Login</Text>
              </TouchableOpacity>
            </BlurView>
          )}
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  backButton: {
    marginBottom: 20,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  formContainer: {
    borderRadius: 30,
    padding: 32,
    overflow: 'hidden',
    alignItems: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(102,126,234,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  lockEmoji: {
    fontSize: 50,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.2)',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  resetButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  resetGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  resetText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  successContainer: {
    borderRadius: 30,
    padding: 40,
    overflow: 'hidden',
    alignItems: 'center',
    marginTop: 40,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(102,126,234,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successEmoji: {
    fontSize: 60,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  successText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  backToLogin: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    backgroundColor: 'rgba(102,126,234,0.1)',
    borderRadius: 16,
  },
  backToLoginText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '700',
  },
});