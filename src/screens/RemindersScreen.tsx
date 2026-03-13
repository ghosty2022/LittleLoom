import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

const REMINDERS = [
  { id: '1', title: 'Potty Time', time: '09:00 AM', emoji: '🚽', enabled: true, repeat: 'Daily' },
  { id: '2', title: 'Feeding', time: '12:00 PM', emoji: '🍼', enabled: true, repeat: 'Daily' },
  { id: '3', title: 'Nap Time', time: '02:00 PM', emoji: '😴', enabled: false, repeat: 'Weekdays' },
  { id: '4', title: 'Bedtime Routine', time: '07:30 PM', emoji: '🌙', enabled: true, repeat: 'Daily' },
  { id: '5', title: 'Vitamin D', time: '08:00 AM', emoji: '💊', enabled: true, repeat: 'Daily' },
];

export default function RemindersScreen({ navigation }: any) {
  const [reminders, setReminders] = useState(REMINDERS);
  const [showPicker, setShowPicker] = useState(false);

  const toggleReminder = (id: string) => {
    setReminders(prev => prev.map(r => 
      r.id === id ? { ...r, enabled: !r.enabled } : r
    ));
  };

  return (
    <LinearGradient colors={['#e0e7ff', '#d1d5ff', '#c7b8ff']} style={styles.container}>
      <StatusBar style="dark" />
      
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.title}>Reminders ⏰</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowPicker(true)}>
            <BlurView intensity={80} style={styles.addBlur}>
              <Ionicons name="add" size={24} color="#667eea" />
            </BlurView>
          </TouchableOpacity>
        </View>

        {/* Next Reminder Card */}
        <BlurView intensity={90} style={styles.nextCard}>
          <View style={styles.nextHeader}>
            <Text style={styles.nextLabel}>Next Reminder</Text>
            <View style={styles.nextBadge}>
              <Text style={styles.nextBadgeText}>in 45 min</Text>
            </View>
          </View>
          <View style={styles.nextContent}>
            <Text style={styles.nextEmoji}>🚽</Text>
            <View>
              <Text style={styles.nextTitle}>Potty Time</Text>
              <Text style={styles.nextTime}>09:00 AM • Daily</Text>
            </View>
          </View>
        </BlurView>

        {/* All Reminders */}
        <Text style={styles.sectionTitle}>All Reminders</Text>
        <BlurView intensity={90} style={styles.listContainer}>
          {reminders.map((reminder, index) => (
            <View key={reminder.id}>
              <View style={styles.reminderRow}>
                <View style={styles.reminderLeft}>
                  <View style={[styles.reminderIcon, { backgroundColor: reminder.enabled ? '#667eea20' : '#99920' }]}>
                    <Text style={styles.reminderEmoji}>{reminder.emoji}</Text>
                  </View>
                  <View>
                    <Text style={[
                      styles.reminderTitle,
                      !reminder.enabled && styles.reminderDisabled
                    ]}>
                      {reminder.title}
                    </Text>
                    <Text style={styles.reminderSub}>
                      {reminder.time} • {reminder.repeat}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={reminder.enabled}
                  onValueChange={() => toggleReminder(reminder.id)}
                  trackColor={{ false: '#ddd', true: '#667eea' }}
                />
              </View>
              {index !== reminders.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </BlurView>

        {/* Smart Suggestions */}
        <Text style={styles.sectionTitle}>Smart Suggestions</Text>
        <TouchableOpacity style={styles.suggestionCard}>
          <BlurView intensity={80} style={styles.suggestionBlur}>
            <Text style={styles.suggestionEmoji}>🧠</Text>
            <View style={styles.suggestionContent}>
              <Text style={styles.suggestionTitle}>Add Sleep Reminder</Text>
              <Text style={styles.suggestionText}>Based on patterns, 8:30 PM might be optimal</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#667eea" />
          </BlurView>
        </TouchableOpacity>
      </ScrollView>

      {showPicker && (
        <DateTimePicker
          value={new Date()}
          mode="time"
          display="spinner"
          onChange={(event, date) => {
            setShowPicker(false);
          }}
        />
      )}
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
  addButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  addBlur: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    overflow: 'hidden',
  },
  nextHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  nextLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  nextBadge: {
    backgroundColor: '#667eea',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  nextBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  nextContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextEmoji: {
    fontSize: 48,
    marginRight: 16,
  },
  nextTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  nextTime: {
    fontSize: 16,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
    marginTop: 8,
  },
  listContainer: {
    borderRadius: 24,
    paddingVertical: 8,
    overflow: 'hidden',
    marginBottom: 24,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  reminderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reminderIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  reminderEmoji: {
    fontSize: 24,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  reminderDisabled: {
    color: '#999',
  },
  reminderSub: {
    fontSize: 13,
    color: '#666',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginLeft: 84,
  },
  suggestionCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  suggestionBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  suggestionEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  suggestionText: {
    fontSize: 13,
    color: '#666',
  },
});