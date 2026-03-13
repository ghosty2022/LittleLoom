import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const ACHIEVEMENTS = [
  { id: '1', title: 'First Steps', description: 'Log your first potty success', emoji: '🚽', unlocked: true, progress: 100 },
  { id: '2', title: 'Week Warrior', description: '7 day streak', emoji: '🔥', unlocked: true, progress: 100 },
  { id: '3', title: 'Sleep Master', description: 'Track 30 naps', emoji: '😴', unlocked: true, progress: 100 },
  { id: '4', title: 'Month Master', description: '30 day streak', emoji: '📅', unlocked: false, progress: 75 },
  { id: '5', title: 'Growth Tracker', description: 'Record 10 measurements', emoji: '📏', unlocked: false, progress: 60 },
  { id: '6', title: 'Sound Explorer', description: 'Try all baby sounds', emoji: '🎵', unlocked: false, progress: 50 },
  { id: '7', title: 'Perfect Parent', description: 'No missed logs for a week', emoji: '⭐', unlocked: false, progress: 0 },
  { id: '8', title: 'Family Sync', description: 'Connect 3 family members', emoji: '👨‍👩‍👧', unlocked: false, progress: 33 },
];

export default function AchievementsScreen({ navigation }: any) {
  const unlockedCount = ACHIEVEMENTS.filter(a => a.unlocked).length;

  return (
    <LinearGradient colors={['#e0e7ff', '#d1d5ff', '#c7b8ff']} style={styles.container}>
      <StatusBar style="dark" />
      
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.title}>Achievements 🏆</Text>
          <View style={{ width: 48 }} />
        </View>

        {/* Progress Overview */}
        <BlurView intensity={90} style={styles.overviewCard}>
          <View style={styles.overviewContent}>
            <View style={styles.progressCircle}>
              <Text style={styles.progressNumber}>{unlockedCount}</Text>
              <Text style={styles.progressTotal}>/{ACHIEVEMENTS.length}</Text>
            </View>
            <View style={styles.overviewText}>
              <Text style={styles.overviewTitle}>Keep it up!</Text>
              <Text style={styles.overviewSubtitle}>
                You've unlocked {unlockedCount} achievements
              </Text>
            </View>
          </View>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${(unlockedCount / ACHIEVEMENTS.length) * 100}%` }
              ]} 
            />
          </View>
        </BlurView>

        {/* Achievements Grid */}
        <Text style={styles.sectionTitle}>All Achievements</Text>
        <View style={styles.grid}>
          {ACHIEVEMENTS.map((achievement) => (
            <BlurView 
              key={achievement.id} 
              intensity={achievement.unlocked ? 90 : 60}
              style={[
                styles.achievementCard,
                !achievement.unlocked && styles.achievementLocked
              ]}
            >
              <View style={styles.achievementHeader}>
                <Text style={[
                  styles.achievementEmoji,
                  !achievement.unlocked && styles.emojiLocked
                ]}>
                  {achievement.emoji}
                </Text>
                {achievement.unlocked && (
                  <View style={styles.unlockedBadge}>
                    <Ionicons name="checkmark" size={16} color="white" />
                  </View>
                )}
              </View>
              <Text style={[
                styles.achievementTitle,
                !achievement.unlocked && styles.textLocked
              ]}>
                {achievement.title}
              </Text>
              <Text style={styles.achievementDesc}>{achievement.description}</Text>
              
              {!achievement.unlocked && (
                <View style={styles.progressContainer}>
                  <View style={styles.achievementProgressBar}>
                    <View 
                      style={[
                        styles.achievementProgressFill, 
                        { width: `${achievement.progress}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.progressText}>{achievement.progress}%</Text>
                </View>
              )}
            </BlurView>
          ))}
        </View>
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
  overviewCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    overflow: 'hidden',
  },
  overviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  progressCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(102,126,234,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginRight: 20,
  },
  progressNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: '#667eea',
  },
  progressTotal: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
  },
  overviewText: {
    flex: 1,
  },
  overviewTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  overviewSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#667eea',
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  achievementCard: {
    width: '47%',
    padding: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  achievementLocked: {
    opacity: 0.7,
  },
  achievementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  achievementEmoji: {
    fontSize: 40,
  },
  emojiLocked: {
    opacity: 0.5,
  },
  unlockedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#11998e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  textLocked: {
    color: '#999',
  },
  achievementDesc: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    marginBottom: 12,
  },
  progressContainer: {
    marginTop: 'auto',
  },
  achievementProgressBar: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  achievementProgressFill: {
    height: '100%',
    backgroundColor: '#667eea',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    color: '#667eea',
    fontWeight: '600',
  },
});