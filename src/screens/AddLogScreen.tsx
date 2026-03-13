import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

const LOG_TYPES = [
  { id: 'potty', label: 'Potty', emoji: '🚽', color: '#667eea' },
  { id: 'feed', label: 'Feed', emoji: '🍼', color: '#fa709a' },
  { id: 'sleep', label: 'Sleep', emoji: '😴', color: '#11998e' },
  { id: 'diaper', label: 'Diaper', emoji: '🧷', color: '#fc5c7d' },
  { id: 'growth', label: 'Growth', emoji: '📏', color: '#fee140' },
  { id: 'milestone', label: 'Milestone', emoji: '🏆', color: '#6a82fb' },
];

export default function AddLogScreen({ navigation, route }: any) {
  const initialType = route.params?.type || 'potty';
  const [selectedType, setSelectedType] = useState(initialType);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleSave = () => {
    navigation.goBack();
  };

  return (
    <LinearGradient colors={['#e0e7ff', '#d1d5ff', '#c7b8ff']} style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.title}>Add Log ➕</Text>
            <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>

          {/* Type Selection */}
          <Text style={styles.sectionLabel}>Log Type</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typesContainer}
          >
            {LOG_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeCard,
                  selectedType === type.id && { 
                    borderColor: type.color,
                    backgroundColor: `${type.color}20`
                  }
                ]}
                onPress={() => setSelectedType(type.id)}
              >
                <Text style={styles.typeEmoji}>{type.emoji}</Text>
                <Text style={[
                  styles.typeLabel,
                  selectedType === type.id && { color: type.color }
                ]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Time Selection */}
          <Text style={styles.sectionLabel}>Time</Text>
          <TouchableOpacity 
            style={styles.timeButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="time-outline" size={24} color="#667eea" />
            <Text style={styles.timeText}>{date.toLocaleString()}</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="datetime"
              display="spinner"
              onChange={(event, selectedDate) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selectedDate) setDate(selectedDate);
              }}
            />
          )}

          {/* Notes */}
          <Text style={styles.sectionLabel}>Notes</Text>
          <BlurView intensity={80} style={styles.notesContainer}>
            <TextInput
              style={styles.notesInput}
              placeholder="Add any details..."
              placeholderTextColor="#999"
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </BlurView>

          {/* Quick Tags */}
          <Text style={styles.sectionLabel}>Quick Tags</Text>
          <View style={styles.tagsContainer}>
            {['Success', 'Accident', 'Self-initiated', 'With help'].map((tag) => (
              <TouchableOpacity key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
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
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#667eea',
    borderRadius: 20,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
    marginTop: 8,
  },
  typesContainer: {
    gap: 12,
    paddingBottom: 8,
  },
  typeCard: {
    width: 80,
    height: 100,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    marginRight: 12,
  },
  typeEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  timeText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  notesContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  notesInput: {
    padding: 16,
    fontSize: 16,
    color: '#333',
    minHeight: 100,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: 'rgba(102,126,234,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.3)',
  },
  tagText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '500',
  },
});