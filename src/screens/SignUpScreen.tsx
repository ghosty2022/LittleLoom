import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../types/navigation';

type SignUpScreenProps = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SignUpScreen({ navigation }: SignUpScreenProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const { signUp, isLoading } = useAuth();
  const insets = useSafeAreaInsets();

  const handleSignUp = useCallback(async () => {
    if (!fullName.trim() || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    const success = await signUp(fullName.trim(), email, password);
    if (success) {
      // After signup, go straight to CreateBabyProfile (not Main)
      navigation.replace('CreateBabyProfile');
    }
  }, [fullName, email, password, confirmPassword, signUp, navigation]);

  return (
    <LinearGradient colors={['#f8faff', '#f0f4ff', '#e8eeff']} style={styles.container}>
      <StatusBar style="dark" />
      <View style={[styles.brandBadge, { top: insets.top + 16 }]}>
        <Text style={styles.brandBadgeText}>LittleLoom</Text>
      </View>

      <TouchableOpacity style={[styles.backButton, { top: insets.top + 16 }]} onPress={() => navigation.goBack()} activeOpacity={0.7}>
        <BlurView intensity={80} style={styles.backButtonBlur}>
          <Ionicons name="chevron-back" size={24} color="#667eea" />
        </BlurView>
      </TouchableOpacity>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Create Account 👋</Text>
            <Text style={styles.subtitle}>Start your journey with your little one</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#667eea" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor="#999" value={fullName} onChangeText={setFullName} autoCapitalize="words" editable={!isLoading} />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#667eea" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Email address" placeholderTextColor="#999" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!isLoading} />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#667eea" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#999" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} editable={!isLoading} />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#999" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#667eea" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Confirm Password" placeholderTextColor="#999" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showConfirmPassword} editable={!isLoading} />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeButton}>
                <Ionicons name={showConfirmPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#999" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.signUpButton} onPress={handleSignUp} disabled={isLoading} activeOpacity={0.8}>
              <LinearGradient colors={['#667eea', '#764ba2']} style={styles.signUpGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                {isLoading ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.signUpText}>Create Account</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  brandBadge: { position: 'absolute', right: 20, backgroundColor: 'rgba(102,126,234,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, zIndex: 10 },
  brandBadgeText: { fontSize: 11, fontWeight: '700', color: '#667eea', letterSpacing: 0.5 },
  backButton: { position: 'absolute', left: 20, zIndex: 10, borderRadius: 12, overflow: 'hidden' },
  backButtonBlur: { padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: 'rgba(102,126,234,0.2)' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 100, paddingBottom: 100 },
  header: { marginBottom: 30 },
  title: { fontSize: 32, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', lineHeight: 20 },
  formContainer: { backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', shadowColor: '#667eea', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 5 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 12, paddingHorizontal: 14, marginBottom: 12, height: 52, borderWidth: 1, borderColor: 'rgba(102,126,234,0.15)' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#333' },
  eyeButton: { padding: 4 },
  signUpButton: { borderRadius: 12, overflow: 'hidden', shadowColor: '#667eea', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5, marginTop: 8 },
  signUpGradient: { paddingVertical: 14, alignItems: 'center' },
  signUpText: { color: 'white', fontSize: 16, fontWeight: '700' },
  loginContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, marginBottom: 20 },
  loginText: { color: '#666', fontSize: 14 },
  loginLink: { color: '#667eea', fontSize: 14, fontWeight: '700' },
});