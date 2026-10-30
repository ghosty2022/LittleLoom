import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { useAuth } from '../../context/AuthContext';
import { useSecurity } from '../../context/SecurityContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import type { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ForcedPasswordChange'>;

const AURA = {
  primary: '#6366f1',
  accent: '#ec4899',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  white: '#ffffff',
  gray400: '#a8a29e',
  gray500: '#78716c',
  gray900: '#1c1917',
  darkBg: '#0c0a09',
};

export default function ForcedPasswordChangeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { userProfile, setNewPasswordAfterTemp } = useAuth();
  const { forceUnlock } = useSecurity();
  const { darkMode: isDark, triggerHaptic } = useCustomization();
  const { error: showError, success: showSuccess } = useSweetAlert();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    if (!newPassword || newPassword.length < 8) {
      showError('Weak Password', 'Password must be at least 8 characters');
      triggerHaptic('error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showError('Password Mismatch', 'Passwords do not match');
      triggerHaptic('error');
      return;
    }
    setIsSaving(true);
    triggerHaptic('medium');
    try {
      const result = await setNewPasswordAfterTemp(newPassword);
      if (result.success) {
        triggerHaptic('success');
        showSuccess('Password Updated', 'Welcome to LittleLoom!');
        try { await forceUnlock(); } catch {}
        // Navigation will detect mustChangePassword === false and route to Main
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      } else {
        showError('Could Not Update', result.message);
        triggerHaptic('error');
      }
    } catch (e: any) {
      showError('Error', e?.message || 'Failed to update password');
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, newPassword, confirmPassword, setNewPasswordAfterTemp, forceUnlock, navigation, showError, showSuccess, triggerHaptic]);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? AURA.darkBg : '#f8faff' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient
        colors={isDark ? ['#0c0a09', '#1a1428', '#0c0a09'] : ['#6366f1', '#8b5cf6', '#ec4899']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
            <View style={styles.iconWrap}>
              <LinearGradient
                colors={[AURA.warning, '#d97706']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Ionicons name="key" size={42} color={AURA.white} />
            </View>
            <Text style={styles.title}>Set Your New Password</Text>
            <Text style={styles.subtitle}>
              {userProfile?.fullName ? `Hi ${userProfile.fullName}, ` : ''}
              You signed in with a temporary password. Please choose a new one to continue.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(150).duration(400)} style={styles.form}>
            <Text style={styles.label}>New Password</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="At least 8 characters"
                placeholderTextColor="rgba(99,102,241,0.5)"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSaving}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={AURA.primary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="shield-checkmark-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Re-enter password"
                placeholderTextColor="rgba(99,102,241,0.5)"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSaving}
                onSubmitEditing={handleSave}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, isSaving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[AURA.primary, AURA.accent]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              {isSaving ? (
                <ActivityIndicator color={AURA.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={AURA.white} />
                  <Text style={styles.saveText}>Save Password</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 32 },
  iconWrap: {
    width: 90, height: 90, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 21, paddingHorizontal: 8 },
  form: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24, padding: 22,
  },
  label: { fontSize: 12, fontWeight: '700', color: '#1c1917', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(99,102,241,0.06)',
    borderRadius: 14, paddingHorizontal: 14, height: 52,
    borderWidth: 1, borderColor: 'rgba(99,102,241,0.15)',
    marginBottom: 18,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, fontWeight: '500', color: '#1c1917' },
  saveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, height: 54, overflow: 'hidden',
    gap: 8, marginTop: 8,
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.4 },
});