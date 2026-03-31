import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useFamily } from '../context/FamilyContext';

// Reusable Components from HomeScreen pattern
const SweetAlert = ({ visible, type, title, message, onClose, isDark }: any) => {
  const [opacity, setOpacity] = useState(0);
  
  React.useEffect(() => {
    if (visible) {
      setOpacity(1);
      const timer = setTimeout(() => {
        setOpacity(0);
        setTimeout(onClose, 300);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const config = {
    success: { colors: ['#11998e', '#38ef7d'], icon: 'checkmark-circle' },
    error: { colors: ['#ef4444', '#f87171'], icon: 'alert-circle' },
    info: { colors: ['#3b82f6', '#60a5fa'], icon: 'information-circle' },
  }[type as keyof typeof config] || config.success;

  return (
    <View style={[styles.alertWrapper, { opacity, zIndex: 9999 }]}>
      <View style={[styles.alertContainer, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
        <LinearGradient colors={config.colors} style={styles.alertIconBg}>
          <Ionicons name={config.icon as any} size={28} color="#fff" />
        </LinearGradient>
        <View style={styles.alertTextContainer}>
          <Text style={[styles.alertTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
        </View>
      </View>
    </View>
  );
};

const ConfirmModal = ({ visible, title, message, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel', type = 'default', isDark }: any) => {
  if (!visible) return null;
  
  const colors = {
    default: ['#667eea', '#764ba2'],
    danger: ['#ef4444', '#dc2626'],
    warning: ['#f59e0b', '#d97706'],
  }[type as keyof typeof colors];

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 10000, justifyContent: 'center', alignItems: 'center' }]}>
      <TouchableOpacity activeOpacity={1} onPress={onCancel} style={StyleSheet.absoluteFill}>
        <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>
      
      <View style={[styles.confirmModal, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
        <LinearGradient colors={colors} style={styles.confirmIconBg}>
          <Ionicons name={type === 'danger' ? 'trash' : type === 'warning' ? 'warning' : 'help-circle'} size={32} color="#fff" />
        </LinearGradient>
        <Text style={[styles.confirmTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{title}</Text>
        <Text style={styles.confirmMessage}>{message}</Text>
        
        <View style={styles.confirmButtons}>
          <TouchableOpacity style={[styles.confirmButton, styles.cancelButton]} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>{cancelText}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onConfirm}>
            <LinearGradient colors={colors} style={styles.confirmButtonGradient}>
              <Text style={styles.confirmButtonText}>{confirmText}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

type AddParentScreenProps = NativeStackScreenProps<RootStackParamList, 'AddParent'>;

export default function AddParentScreen({ navigation }: AddParentScreenProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ visible: false, type: 'success', title: '', message: '' });
  const [confirmModal, setConfirmModal] = useState({ visible: false, title: '', message: '', onConfirm: () => {}, type: 'default' });

  const { parent2, updateParent2Profile, inviteMember } = useFamily();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const showToast = useCallback((type: 'success' | 'error' | 'info', title: string, message: string) => {
    setAlert({ visible: true, type, title, message });
  }, []);

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleAddParent = useCallback(async () => {
    if (!fullName.trim() || !email.trim()) {
      showToast('error', 'Missing Information', 'Please enter both name and email');
      return;
    }

    if (!validateEmail(email)) {
      showToast('error', 'Invalid Email', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      // If parent2 exists, update profile, otherwise invite
      if (parent2) {
        await updateParent2Profile({
          fullName: fullName.trim(),
          email: email.trim(),
          phoneNumber: phoneNumber.trim() || undefined,
        });
      } else {
        await inviteMember(email.trim(), 'parent2' as any, 'Co-Parent');
      }

      showToast('success', 'Success! 🎉', `${fullName} has been added as a co-parent`);
      setTimeout(() => navigation.goBack(), 1500);
    } catch (error) {
      showToast('error', 'Error', 'Failed to add parent. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [fullName, email, phoneNumber, parent2, updateParent2Profile, inviteMember, navigation, showToast]);

  // If parent 2 already exists, show info instead
  if (parent2) {
    return (
      <View style={styles.container}>
        <LinearGradient 
          colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f0f4ff', '#e0e7ff']} 
          style={styles.gradient}
        >
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={80} color="#43e97b" />
              </View>
              <Text style={[styles.successTitle, isDark && styles.textDark]}>Second Parent Added! 🎉</Text>
              <Text style={styles.successText}>
                {parent2.fullName} has been added as a co-parent.
              </Text>
              <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()}>
                <LinearGradient colors={['#667eea', '#764ba2']} style={styles.doneGradient}>
                  <Text style={styles.doneText}>Done</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
        
        <SweetAlert {...alert} onClose={() => setAlert({ ...alert, visible: false })} isDark={isDark} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient 
        colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f0f4ff', '#e0e7ff']} 
        style={styles.gradient}
      >
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView 
            contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <Animated.View entering={FadeInUp} style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <BlurView intensity={80} style={styles.backBlur}>
                  <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
                </BlurView>
              </TouchableOpacity>
              <Text style={[styles.title, isDark && styles.textDark]}>Add Parent 👨‍👩‍👧</Text>
              <View style={styles.placeholder} />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(100)}>
              <Text style={[styles.subtitle, isDark && { color: '#94a3b8' }]}>
                Invite your partner to co-manage your baby's logs and milestones
              </Text>
            </Animated.View>

            {/* Form */}
            <Animated.View entering={FadeIn.delay(200)}>
              <BlurView intensity={90} style={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, isDark && styles.textDark]}>Full Name *</Text>
                  <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                    <Ionicons name="person-outline" size={24} color="#667eea" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, isDark && styles.textDark]}
                      placeholder="Enter parent's name"
                      placeholderTextColor={isDark ? '#64748b' : '#999'}
                      value={fullName}
                      onChangeText={setFullName}
                      autoCapitalize="words"
                      editable={!loading}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, isDark && styles.textDark]}>Email Address *</Text>
                  <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                    <Ionicons name="mail-outline" size={24} color="#667eea" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, isDark && styles.textDark]}
                      placeholder="parent@email.com"
                      placeholderTextColor={isDark ? '#64748b' : '#999'}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      editable={!loading}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, isDark && styles.textDark]}>Phone Number (Optional)</Text>
                  <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                    <Ionicons name="call-outline" size={24} color="#667eea" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, isDark && styles.textDark]}
                      placeholder="+1 (555) 123-4567"
                      placeholderTextColor={isDark ? '#64748b' : '#999'}
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      keyboardType="phone-pad"
                      editable={!loading}
                    />
                  </View>
                </View>
              </BlurView>
            </Animated.View>

            {/* Info Card */}
            <Animated.View entering={FadeIn.delay(300)}>
              <BlurView intensity={80} style={styles.infoCard}>
                <Ionicons name="information-circle" size={24} color="#667eea" />
                <Text style={[styles.infoText, isDark && { color: '#94a3b8' }]}>
                  The second parent will have full access to view and edit all baby logs, 
                  milestones, and settings. They will not be able to delete the account.
                </Text>
              </BlurView>
            </Animated.View>

            {/* Add Button */}
            <Animated.View entering={FadeIn.delay(400)}>
              <TouchableOpacity 
                style={[styles.addButton, loading && styles.addButtonDisabled]}
                onPress={handleAddParent}
                disabled={loading}
              >
                <LinearGradient colors={['#667eea', '#764ba2']} style={styles.addGradient}>
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Ionicons name="person-add" size={24} color="white" />
                      <Text style={styles.addText}>Add Co-Parent</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>

      <SweetAlert {...alert} onClose={() => setAlert({ ...alert, visible: false })} isDark={isDark} />
      <ConfirmModal 
        {...confirmModal} 
        onCancel={() => setConfirmModal({ ...confirmModal, visible: false })}
        onConfirm={() => {
          confirmModal.onConfirm();
          setConfirmModal({ ...confirmModal, visible: false });
        }}
        isDark={isDark}
      />
    </View>
  );
}

import { ActivityIndicator } from 'react-native';

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24 },
  
  // Alert Styles (from HomeScreen)
  alertWrapper: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    position: 'absolute',
  },
  alertContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    minWidth: 300,
    maxWidth: 360,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  alertIconBg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  alertTextContainer: { flex: 1 },
  alertTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  alertMessage: { fontSize: 13, color: '#64748b' },

  // Confirm Modal Styles
  confirmModal: {
    width: 320,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
  },
  confirmIconBg: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  confirmTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  confirmMessage: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  confirmButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  confirmButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cancelButton: { backgroundColor: 'rgba(100,116,139,0.1)' },
  cancelButtonText: { color: '#64748b', fontSize: 15, fontWeight: '600' },
  confirmButtonGradient: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  confirmButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Original Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backButton: { borderRadius: 16, overflow: 'hidden' },
  backBlur: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
  textDark: { color: '#fff' },
  placeholder: { width: 48 },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    lineHeight: 22,
  },
  formContainer: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  inputGroup: { marginBottom: 20 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.2)',
  },
  inputContainerDark: {
    backgroundColor: 'rgba(30,30,40,0.6)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    overflow: 'hidden',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  addButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  addButtonDisabled: { opacity: 0.7 },
  addGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  addText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  successIcon: { marginBottom: 24 },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 12,
    textAlign: 'center',
  },
  successText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  doneButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  doneGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
});