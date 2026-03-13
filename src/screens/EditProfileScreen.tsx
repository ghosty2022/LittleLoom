import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const SKIN_TONES = ['👶🏻', '👶🏼', '👶🏽', '👶🏾', '👶🏿'];

export default function EditProfileScreen({ navigation }: any) {
  const [babyName, setBabyName] = useState('Emma');
  const [parentName, setParentName] = useState('Sarah');
  const [selectedSkin, setSelectedSkin] = useState(2);

  return (
    <LinearGradient colors={['#e0e7ff', '#d1d5ff', '#c7b8ff']} style={styles.container}>
      <StatusBar style="dark" />
      
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.title}>Edit Profile ✏️</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <Text style={styles.avatarEmoji}>{SKIN_TONES[selectedSkin]}</Text>
          <TouchableOpacity style={styles.changePhotoButton}>
            <BlurView intensity={80} style={styles.changePhotoBlur}>
              <Ionicons name="camera" size={20} color="#667eea" />
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </BlurView>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <BlurView intensity={90} style={styles.formContainer}>
          <Text style={styles.sectionLabel}>Baby Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Baby's Name</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="heart-outline" size={24} color="#667eea" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={babyName}
                onChangeText={setBabyName}
                placeholder="Enter name"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Birth Date</Text>
            <TouchableOpacity style={styles.inputContainer}>
              <Ionicons name="calendar-outline" size={24} color="#667eea" style={styles.inputIcon} />
              <Text style={styles.input}>September 12, 2024</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Skin Tone</Text>
            <View style={styles.skinContainer}>
              {SKIN_TONES.map((skin, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.skinButton,
                    selectedSkin === index && styles.skinButtonActive
                  ]}
                  onPress={() => setSelectedSkin(index)}
                >
                  <Text style={styles.skinEmoji}>{skin}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </BlurView>

        {/* Parent Info */}
        <BlurView intensity={90} style={styles.formContainer}>
          <Text style={styles.sectionLabel}>Parent Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Your Name</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={24} color="#667eea" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={parentName}
                onChangeText={setParentName}
                placeholder="Enter your name"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={24} color="#667eea" style={styles.inputIcon} />
              <Text style={styles.input}>sarah@email.com</Text>
            </View>
          </View>
        </BlurView>

        {/* Danger Zone */}
        <TouchableOpacity style={styles.deleteButton}>
          <Text style={styles.deleteText}>Delete Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#667eea',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarEmoji: {
    fontSize: 100,
    marginBottom: 16,
  },
  changePhotoButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  changePhotoBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
  },
  changePhotoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
  formContainer: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    overflow: 'hidden',
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  skinContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  skinButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  skinButtonActive: {
    borderColor: '#667eea',
  },
  skinEmoji: {
    fontSize: 32,
  },
  deleteButton: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 16,
  },
  deleteText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff4757',
  },
});