import React, { useCallback, useMemo } from 'react';
import {
  StatusBar,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  RefreshControl,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { 
  FadeIn,
  FadeInUp,
  Layout
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow } from 'date-fns';

import { useBabyStore } from '../stores/useBabyStore';
import { GlassmorphismCard } from '../components/GlassmorphismCard';
import { CircularProgress } from '../components/CircularProgress';
import { useCountdown } from '../hooks/useCountdown';
import { QuickAction, TimelineEvent } from '../types';
import { RootStackScreenProps } from '../types';

const { width } = Dimensions.get('window');
const SKIN_TONES = ['👶🏻', '👶🏼', '👶🏽', '👶🏾', '👶🏿'];

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'potty', label: 'Potty', emoji: '🚽', color: ['#667eea', '#764ba2'], description: 'Log potty training progress' },
  { id: 'feed', label: 'Feed', emoji: '🍼', color: ['#fa709a', '#fee140'], description: 'Record feeding time' },
  { id: 'sleep', label: 'Sleep', emoji: '😴', color: ['#11998e', '#38ef7d'], description: 'Track sleep schedule' },
  { id: 'diaper', label: 'Diaper', emoji: '🧷', color: ['#fc5c7d', '#6a82fb'], description: 'Change diaper log' },
];

const BABY_SOUNDS = [
  { id: '1', name: 'Lullaby', emoji: '🌙', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3', color: ['#667eea', '#764ba2'] as const },
  { id: '2', name: 'Gentle Rain', emoji: '🌧️', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', color: ['#11998e', '#38ef7d'] as const },
  { id: '3', name: 'Baby Giggles', emoji: '😆', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', color: ['#fc5c7d', '#6a82fb'] as const },
  { id: '4', name: 'Sweet Coos', emoji: '🍼', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', color: ['#fa709a', '#fee140'] as const },
];

type HomeScreenProps = RootStackScreenProps<'Main'>;

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { baby, timeline, sounds, updateSoundStatus, addEvent } = useBabyStore();
  const { minutes, isExpired, progress } = useCountdown(45);
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleQuickAction = useCallback((action: QuickAction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addEvent({
      icon: action.emoji,
      title: `${action.label} Started`,
      time: 'Just now',
      type: action.id as TimelineEvent['type'],
    });
    navigation.navigate('AddLog', { type: action.id });
  }, [addEvent, navigation]);

  const toggleSound = useCallback((soundId: string) => {
    const currentSound = sounds.find(s => s.id === soundId);
    const isCurrentlyPlaying = currentSound?.isPlaying || false;
    
    // Stop all other sounds first
    sounds.forEach(s => {
      if (s.id !== soundId && s.isPlaying) {
        updateSoundStatus(s.id, { isPlaying: false });
      }
    });
    
    updateSoundStatus(soundId, { isPlaying: !isCurrentlyPlaying });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [sounds, updateSoundStatus]);

  const stats = useMemo(() => [
    { label: 'Potty', value: 85, color: '#667eea' },
    { label: 'Sleep', value: 92, color: '#11998e' },
    { label: 'Feed', value: 78, color: '#fa709a' },
  ], []);

  const getIconColor = useCallback((type: string) => {
    const colors: Record<string, string> = {
      potty: 'rgba(102,126,234,0.2)',
      feed: 'rgba(250,112,154,0.2)',
      sleep: 'rgba(17,153,142,0.2)',
      diaper: 'rgba(252,92,125,0.2)',
    };
    return colors[type] || 'rgba(102,126,234,0.2)';
  }, []);

  const formatEventTime = useCallback((timestamp: number) => {
    try {
      return formatDistanceToNow(timestamp, { addSuffix: true });
    } catch {
      return 'Just now';
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        // Cleanup if needed
      };
    }, [])
  );

  return (
    <LinearGradient colors={['#e0e7ff', '#d1d5ff', '#c7b8ff']} style={styles.container}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header Actions */}
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={() => navigation.navigate('Achievements')}
          >
            <GlassmorphismCard intensity={60} style={styles.iconBlur} scaleOnPress={false}>
              <Text style={styles.headerIcon}>🏆</Text>
            </GlassmorphismCard>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={() => navigation.navigate('Reminders')}
          >
            <GlassmorphismCard intensity={60} style={styles.iconBlur} scaleOnPress={false}>
              <Text style={styles.headerIcon}>🔔</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>2</Text>
              </View>
            </GlassmorphismCard>
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <Animated.View entering={FadeInUp.springify()}>
          <GlassmorphismCard style={styles.profileCard} intensity={90}>
            <LinearGradient colors={['#fa709a', '#fee140']} style={styles.streakBadge}>
              <Text style={styles.streakText}>🔥 {baby.streak} days</Text>
            </LinearGradient>

            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => navigation.navigate('EditProfile')}
            >
              <Ionicons name="pencil" size={20} color="#667eea" />
            </TouchableOpacity>

            <View style={styles.profileRow}>
              <Text style={styles.avatarEmoji}>{SKIN_TONES[baby.skinIndex]}</Text>
              <View>
                <Text style={styles.babyName}>{baby.name}</Text>
                <Text style={styles.babyAge}>{baby.age}</Text>
              </View>
            </View>

            <View style={styles.progressRow}>
              {stats.map((stat, i) => (
                <CircularProgress
                  key={stat.label}
                  progress={stat.value}
                  value={stat.value}
                  label={stat.label}
                  color={stat.color}
                  delay={i * 100}
                />
              ))}
            </View>

            <View style={styles.milestoneContainer}>
              <View style={styles.milestoneHeader}>
                <Text style={styles.milestoneTitle}>Next: {baby.nextMilestone}</Text>
                <Text style={styles.milestonePercent}>{baby.milestoneProgress}%</Text>
              </View>
              <View style={styles.milestoneBar}>
                <View style={[styles.milestoneFill, { width: `${baby.milestoneProgress}%` }]} />
              </View>
            </View>
          </GlassmorphismCard>
        </Animated.View>

        {/* Quick Actions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Log ✨</Text>
          <TouchableOpacity onPress={() => navigation.navigate('AddLog')}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map((action, index) => (
            <AnimatedTouchable
              key={action.id}
              entering={FadeInUp.delay(index * 100).springify()}
              layout={Layout.springify()}
              style={styles.actionCard}
              onPress={() => handleQuickAction(action)}
              activeOpacity={0.8}
            >
              <LinearGradient colors={action.color} style={styles.actionIcon}>
                <Text style={styles.actionEmoji}>{action.emoji}</Text>
              </LinearGradient>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </AnimatedTouchable>
          ))}
        </View>

        {/* Baby Sounds */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Baby Sounds 🎵</Text>
          <TouchableOpacity onPress={() => navigation.navigate('SoundMixer')}>
            <GlassmorphismCard intensity={60} style={styles.mixerButton}>
              <Text style={styles.mixerText}>Mixer</Text>
            </GlassmorphismCard>
          </TouchableOpacity>
        </View>
        
        <View style={styles.soundGrid}>
          {BABY_SOUNDS.map((sound, index) => {
            const isPlaying = sounds.find(s => s.id === sound.id)?.isPlaying || false;
            
            return (
              <Animated.View 
                key={sound.id} 
                entering={FadeIn.delay(200 + index * 50)}
                style={styles.soundCard}
              >
                <LinearGradient colors={sound.color} style={styles.soundGradient}>
                  <TouchableOpacity 
                    onPress={() => toggleSound(sound.id)} 
                    style={styles.soundButton}
                  >
                    <Text style={styles.soundEmoji}>{sound.emoji}</Text>
                    <View style={styles.playOverlay}>
                      <Text style={styles.playIcon}>{isPlaying ? '⏸️' : '▶️'}</Text>
                    </View>
                  </TouchableOpacity>
                </LinearGradient>
                <Text style={styles.soundName}>{sound.name}</Text>
                
                {isPlaying && (
                  <View style={styles.waveformContainer}>
                    <View style={styles.waveform}>
                      {[...Array(5)].map((_, i) => (
                        <Animated.View 
                          key={i}
                          entering={FadeIn.delay(i * 50)}
                          style={[
                            styles.waveBar, 
                            { 
                              height: 4 + Math.random() * 12,
                              backgroundColor: sound.color[0]
                            }
                          ]} 
                        />
                      ))}
                    </View>
                  </View>
                )}
                
                <Text style={styles.timeText}>
                  {isPlaying ? 'Playing...' : 'Tap to play'}
                </Text>
              </Animated.View>
            );
          })}
        </View>

        {/* Countdown */}
        <TouchableOpacity onPress={() => navigation.navigate('Reminders')}>
          <GlassmorphismCard style={styles.countdownCard} intensity={70}>
            <View style={styles.countdownContent}>
              <Text style={styles.countdownIcon}>⏰</Text>
              <View style={styles.countdownTextContainer}>
                <Text style={styles.countdownText}>
                  Next potty in <Text style={[styles.countdownHighlight, isExpired && styles.expired]}>{minutes}</Text> min
                </Text>
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: isExpired ? '#ff4757' : '#667eea' }]} />
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#667eea" />
            </View>
          </GlassmorphismCard>
        </TouchableOpacity>

        {/* Timeline */}
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {timeline.slice(0, 5).map((item, index) => (
          <Animated.View 
            key={item.id} 
            entering={FadeInUp.delay(index * 50)}
            layout={Layout.springify()}
          >
            <TouchableOpacity onPress={() => navigation.navigate('Timeline')}>
              <GlassmorphismCard style={styles.timelineItem} intensity={60}>
                <View style={[styles.timelineIconBg, { backgroundColor: getIconColor(item.type) }]}>
                  <Text style={styles.timelineIcon}>{item.icon}</Text>
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>{item.title}</Text>
                  <Text style={styles.timelineTime}>{formatEventTime(item.timestamp)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </GlassmorphismCard>
            </TouchableOpacity>
          </Animated.View>
        ))}

        <TouchableOpacity 
          style={styles.viewAllButton}
          onPress={() => navigation.navigate('Timeline')}
        >
          <Text style={styles.viewAllText}>View Full Timeline</Text>
          <Ionicons name="arrow-forward" size={20} color="#667eea" />
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 140, paddingTop: Platform.OS === 'ios' ? 60 : 40 },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    gap: 12,
  },
  iconButton: { borderRadius: 16, overflow: 'hidden' },
  iconBlur: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerIcon: { fontSize: 24 },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ff4757',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  badgeText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  profileCard: {
    margin: 24,
    marginTop: 16,
    padding: 28,
    borderRadius: 32,
  },
  streakBadge: {
    position: 'absolute',
    top: 24,
    right: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 30,
  },
  streakText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
  editButton: {
    position: 'absolute',
    top: 24,
    left: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  avatarEmoji: { fontSize: 80 },
  babyName: { fontSize: 28, fontWeight: '800', color: '#1a1a1a' },
  babyAge: { fontSize: 16, color: '#555' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 32 },
  milestoneContainer: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  milestoneHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  milestoneTitle: { fontSize: 14, fontWeight: '600', color: '#666' },
  milestonePercent: { fontSize: 14, fontWeight: '700', color: '#667eea' },
  milestoneBar: { height: 8, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 4, overflow: 'hidden' },
  milestoneFill: { height: '100%', backgroundColor: '#667eea', borderRadius: 4 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 32,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  seeAll: { fontSize: 14, color: '#667eea', fontWeight: '600' },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 16,
  },
  actionCard: { width: (width - 72) / 2, alignItems: 'center', marginBottom: 8 },
  actionIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  actionEmoji: { fontSize: 36 },
  actionLabel: { fontSize: 15, color: '#444', fontWeight: '600' },
  mixerButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  mixerText: { fontSize: 14, fontWeight: '600', color: '#667eea' },
  soundGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 16,
  },
  soundCard: {
    width: (width - 72) / 2,
    backgroundColor: 'rgba(255,255,255,0.48)',
    padding: 16,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  soundGradient: { width: '100%', height: 100, borderRadius: 20, marginBottom: 12 },
  soundButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  soundEmoji: { fontSize: 40, marginBottom: 8 },
  playOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { fontSize: 16 },
  soundName: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 8 },
  waveformContainer: {
    height: 20,
    width: '100%',
    marginBottom: 8,
    justifyContent: 'center',
  },
  waveform: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  timeText: { fontSize: 12, color: '#999' },
  countdownCard: { margin: 24, padding: 20, borderRadius: 24 },
  countdownContent: { flexDirection: 'row', alignItems: 'center' },
  countdownIcon: { fontSize: 32, marginRight: 16 },
  countdownTextContainer: { flex: 1 },
  countdownText: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  countdownHighlight: { color: '#667eea', fontSize: 20, fontWeight: '700' },
  expired: { color: '#ff4757' },
  progressBarContainer: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressBarFill: { height: '100%', borderRadius: 2 },
  timelineItem: {
    marginHorizontal: 24,
    marginVertical: 8,
    padding: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineIconBg: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  timelineIcon: { fontSize: 24 },
  timelineContent: { flex: 1 },
  timelineTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  timelineTime: { fontSize: 13, color: '#666', marginTop: 2 },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 16,
    paddingVertical: 12,
  },
  viewAllText: { fontSize: 16, fontWeight: '600', color: '#667eea', marginRight: 8 },
});