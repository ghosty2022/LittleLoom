import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

const SKIN_TONES = [
  { emoji: '👶🏻', color: '#ffdbac', label: 'Light' },
  { emoji: '👶🏼', color: '#f1c27d', label: 'Medium Light' },
  { emoji: '👶🏽', color: '#e0ac69', label: 'Medium' },
  { emoji: '👶🏾', color: '#8d5524', label: 'Medium Dark' },
  { emoji: '👶🏿', color: '#3b2219', label: 'Dark' },
];

const AVATAR_OPTIONS = ['👶', '🧒', '👧', '👦', '🍼', '🧸', '🎀', '⚽'];

export default function CreateBabyProfileScreen({ navigation }: any) {
  const [babyName, setBabyName] = useState('');
  const [birthDate, setBirthDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedSkin, setSelectedSkin] = useState(2);
  const [selectedAvatar, setSelectedAvatar] = useState(0);
  const [gender, setGender] = useState<'boy' | 'girl' | 'other'>('girl');
  const [loading, setLoading] = useState(false);

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setBirthDate(selectedDate);
    }
  };

  const calculateAge = () => {
    const now = new Date();
    const diff = now.getTime() - birthDate.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 30) return `${days} days`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} months`;
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    return remainingMonths > 0 ? `${years}y ${remainingMonths}m` : `${years} years`;
  };

  const handleContinue = async () => {
    if (!babyName) {
      Alert.alert('Error', 'Please enter your baby\'s name');
      return;
    }
    
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigation.navigate('Main');
    }, 1000);
  };

  return (
    <LinearGradient colors={['#e0e7ff', '#d1d5ff', '#c7b8ff']} style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Create Baby Profile 🍼</Text>
          <Text style={styles.subtitle}>Let's set up your little one's profile</Text>
        </View>

        {/* Profile Preview */}
        <BlurView intensity={90} style={styles.previewContainer}>
          <View style={styles.avatarContainer}>
            <Text style={styles.previewAvatar}>
              {AVATAR_OPTIONS[selectedAvatar]}
            </Text>
            <View style={[styles.skinIndicator, { backgroundColor: SKIN_TONES[selectedSkin].color }]} />
          </View>
          <Text style={styles.previewName}>{babyName || 'Your Baby'}</Text>
          <Text style={styles.previewAge}>{calculateAge()}</Text>
        </BlurView>

        {/* Form */}
        <BlurView intensity={90} style={styles.formContainer}>
          {/* Baby Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Baby's Name</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="heart-outline" size={24} color="#667eea" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter name"
                placeholderTextColor="#999"
                value={babyName}
                onChangeText={setBabyName}
              />
            </View>
          </View>

          {/* Birth Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Birth Date</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={24} color="#667eea" />
              <Text style={styles.dateText}>{birthDate.toLocaleDateString()}</Text>
              <Ionicons name="chevron-forward" size={24} color="#999" />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={birthDate}
                mode="date"
                display="spinner"
                onChange={onDateChange}
                maximumDate={new Date()}
              />
            )}
          </View>

          {/* Gender Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.genderContainer}>
              {(['girl', 'boy', 'other'] as const).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderButton, gender === g && styles.genderButtonActive]}
                  onPress={() => setGender(g)}
                >
                  <Text style={styles.genderEmoji}>
                    {g === 'girl' ? '👧' : g === 'boy' ? '👦' : '👶'}
                  </Text>
                  <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Skin Tone */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Skin Tone</Text>
            <View style={styles.skinContainer}>
              {SKIN_TONES.map((skin, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.skinButton,
                    selectedSkin === index && styles.skinButtonActive,
                  ]}
                  onPress={() => setSelectedSkin(index)}
                >
                  <Text style={styles.skinEmoji}>{skin.emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Avatar Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Choose Avatar</Text>
            <View style={styles.avatarGrid}>
              {AVATAR_OPTIONS.map((avatar, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.avatarOption,
                    selectedAvatar === index && styles.avatarOptionActive,
                  ]}
                  onPress={() => setSelectedAvatar(index)}
                >
                  <Text style={styles.avatarOptionText}>{avatar}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </BlurView>

        {/* Continue Button */}
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <LinearGradient colors={['#667eea', '#764ba2']} style={styles.continueGradient}>
            <Text style={styles.continueText}>Continue to Dashboard</Text>
            <Ionicons name="arrow-forward" size={24} color="white" />
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  previewContainer: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 30,
    marginBottom: 24,
    overflow: 'hidden',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  previewAvatar: {
    fontSize: 80,
  },
  skinIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: 'white',
  },
  previewName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  previewAge: {
    fontSize: 16,
    color: '#667eea',
    fontWeight: '600',
    marginTop: 4,
  },
  formContainer: {
    borderRadius: 30,
    padding: 24,
    overflow: 'hidden',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
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
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.2)',
  },
  dateText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  genderContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  genderButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  genderButtonActive: {
    borderColor: '#667eea',
    backgroundColor: 'rgba(102,126,234,0.1)',
  },
  genderEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  genderText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  genderTextActive: {
    color: '#667eea',
  },
  skinContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  skinButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  skinButtonActive: {
    borderColor: '#667eea',
    transform: [{ scale: 1.1 }],
  },
  skinEmoji: {
    fontSize: 32,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  avatarOption: {
    width: (styles.container?.width || 300) / 4 - 20,
    aspectRatio: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarOptionActive: {
    borderColor: '#667eea',
    backgroundColor: 'rgba(102,126,234,0.1)',
  },
  avatarOptionText: {
    fontSize: 32,
  },
  continueButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  continueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  continueText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
});