import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const FILTERS = ['All', 'Potty', 'Feed', 'Sleep', 'Growth', 'Health'];

const TIMELINE_DATA = [
  {
    id: '1',
    date: 'Today',
    events: [
      { id: 't1', time: '10:30 AM', icon: '🎉', title: 'Potty Success!', subtitle: 'No accidents today', type: 'potty', color: '#667eea' },
      { id: 't2', time: '08:15 AM', icon: '🍼', title: 'Morning Bottle', subtitle: '6oz whole milk', type: 'feed', color: '#fa709a' },
      { id: 't3', time: '07:00 AM', icon: '😴', title: 'Woke Up', subtitle: 'Slept 10 hours', type: 'sleep', color: '#11998e' },
    ]
  },
  {
    id: '2',
    date: 'Yesterday',
    events: [
      { id: 'y1', time: '08:00 PM', icon: '😴', title: 'Bedtime', subtitle: 'Fell asleep quickly', type: 'sleep', color: '#11998e' },
      { id: 'y2', time: '06:30 PM', icon: '🍎', title: 'Dinner', subtitle: 'Mashed potatoes & peas', type: 'feed', color: '#fa709a' },
      { id: 'y3', time: '03:00 PM', icon: '🎉', title: 'Potty Success!', subtitle: 'Self-initiated', type: 'potty', color: '#667eea' },
      { id: 'y4', time: '01:00 PM', icon: '😴', title: 'Nap Time', subtitle: '2 hours', type: 'sleep', color: '#11998e' },
    ]
  },
  {
    id: '3',
    date: 'March 11',
    events: [
      { id: 'm1', time: '02:00 PM', icon: '📏', title: 'Height Check', subtitle: '32 inches (+0.5")', type: 'growth', color: '#fc5c7d' },
      { id: 'm2', time: '11:00 AM', icon: '💉', title: 'Vaccination', subtitle: '12-month shots', type: 'health', color: '#ff6b6b' },
    ]
  }
];

export default function TimelineScreen({ navigation }: any) {
  const [selectedFilter, setSelectedFilter] = useState('All');

  const filteredData = selectedFilter === 'All' 
    ? TIMELINE_DATA 
    : TIMELINE_DATA.map(day => ({
        ...day,
        events: day.events.filter(e => 
          selectedFilter.toLowerCase() === 'potty' && e.type === 'potty' ||
          selectedFilter.toLowerCase() === 'feed' && e.type === 'feed' ||
          selectedFilter.toLowerCase() === 'sleep' && e.type === 'sleep' ||
          selectedFilter.toLowerCase() === 'growth' && e.type === 'growth' ||
          selectedFilter.toLowerCase() === 'health' && e.type === 'health'
        )
      })).filter(day => day.events.length > 0);

  return (
    <LinearGradient colors={['#e0e7ff', '#d1d5ff', '#c7b8ff']} style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.title}>Timeline 📜</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddLog')}>
          <BlurView intensity={80} style={styles.addBlur}>
            <Ionicons name="add" size={24} color="#667eea" />
          </BlurView>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContainer}
      >
        {FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter}
            onPress={() => setSelectedFilter(filter)}
            style={[
              styles.filterChip,
              selectedFilter === filter && styles.filterChipActive
            ]}
          >
            <BlurView intensity={selectedFilter === filter ? 100 : 80} style={styles.filterBlur}>
              <Text style={[
                styles.filterText,
                selectedFilter === filter && styles.filterTextActive
              ]}>
                {filter}
              </Text>
            </BlurView>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Timeline */}
      <ScrollView contentContainerStyle={styles.timelineContainer} showsVerticalScrollIndicator={false}>
        {filteredData.map((day, dayIndex) => (
          <View key={day.id} style={styles.daySection}>
            <Text style={styles.dateHeader}>{day.date}</Text>
            <View style={styles.eventsContainer}>
              {day.events.map((event, eventIndex) => (
                <View key={event.id} style={styles.eventRow}>
                  <View style={styles.timeColumn}>
                    <Text style={styles.timeText}>{event.time}</Text>
                    {eventIndex !== day.events.length - 1 && (
                      <View style={styles.timelineLine} />
                    )}
                  </View>
                  <BlurView intensity={70} style={styles.eventCard}>
                    <View style={[styles.iconContainer, { backgroundColor: `${event.color}20` }]}>
                      <Text style={styles.eventIcon}>{event.icon}</Text>
                    </View>
                    <View style={styles.eventContent}>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                      <Text style={styles.eventSubtitle}>{event.subtitle}</Text>
                    </View>
                    <TouchableOpacity style={styles.moreButton}>
                      <Ionicons name="ellipsis-horizontal" size={20} color="#999" />
                    </TouchableOpacity>
                  </BlurView>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
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
  filtersContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  filterChip: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  filterChipActive: {
    transform: [{ scale: 1.05 }],
  },
  filterBlur: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterTextActive: {
    color: '#667eea',
  },
  timelineContainer: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  daySection: {
    marginBottom: 24,
  },
  dateHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
    marginLeft: 4,
  },
  eventsContainer: {
    gap: 12,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timeColumn: {
    width: 70,
    alignItems: 'flex-start',
  },
  timeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#667eea',
    marginTop: 16,
  },
  timelineLine: {
    width: 2,
    height: 60,
    backgroundColor: 'rgba(102,126,234,0.2)',
    marginLeft: 20,
    marginTop: 8,
  },
  eventCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  eventIcon: {
    fontSize: 24,
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  eventSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  moreButton: {
    padding: 8,
  },
});