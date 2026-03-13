import React, { useState } from 'react';
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

const STATS = [
  { label: 'Posts', value: '156' },
  { label: 'Followers', value: '2.4k' },
  { label: 'Following', value: '892' },
  { label: 'Helpful', value: '4.2k' },
];

const BADGES = [
  { emoji: '🏆', name: 'Top Contributor', color: '#fee140' },
  { emoji: '💙', name: 'Helpful Parent', color: '#667eea' },
  { emoji: '🔥', name: '30 Day Streak', color: '#fc5c7d' },
  { emoji: '⭐', name: 'Rising Star', color: '#11998e' },
];

const RECENT_POSTS = [
  {
    id: '1',
    content: 'Just shared our potty training journey! Check it out 👇',
    topic: 'Potty Training',
    likes: 234,
    comments: 45,
    time: '2d ago',
  },
  {
    id: '2',
    content: 'Question about 18-month sleep regression - any advice?',
    topic: 'Sleep Tips',
    likes: 567,
    comments: 89,
    time: '5d ago',
  },
];

export default function UserProfileScreen({ navigation }: any) {
  const [following, setFollowing] = useState(false);

  return (
    <LinearGradient colors={['#e0e7ff', '#d1d5ff', '#c7b8ff']} style={styles.container}>
      <StatusBar style="dark" />
      
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color="#1a1a1a" />
          </TouchableOpacity>
          <TouchableOpacity>
            <Ionicons name="ellipsis-horizontal" size={24} color="#1a1a1a" />
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <BlurView intensity={90} style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Text style={styles.avatar}>👩</Text>
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark" size={14} color="white" />
            </View>
          </View>
          
          <Text style={styles.name}>Sarah M.</Text>
          <Text style={styles.handle}>@sarah_parenting</Text>
          <Text style={styles.bio}>
            Mom of two | Potty training expert 🚽 | Sharing real parenting moments 💙
          </Text>
          
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.location}>San Francisco, CA</Text>
            <Text style={styles.dot}>•</Text>
            <Ionicons name="time-outline" size={16} color="#666" />
            <Text style={styles.joined}>Joined March 2024</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.followButton, following && styles.followingButton]}
              onPress={() => setFollowing(!following)}
            >
              <Text style={[styles.followText, following && styles.followingText]}>
                {following ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.messageButton}>
              <Ionicons name="mail-outline" size={20} color="#667eea" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.moreButton}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#667eea" />
            </TouchableOpacity>
          </View>
        </BlurView>

        {/* Stats */}
        <View style={styles.statsContainer}>
          {STATS.map((stat, index) => (
            <View key={stat.label} style={styles.statItem}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
              {index !== STATS.length - 1 && <View style={styles.statDivider} />}
            </View>
          ))}
        </View>

        {/* Badges */}
        <Text style={styles.sectionTitle}>Achievements</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.badgesContainer}
        >
          {BADGES.map((badge) => (
            <View key={badge.name} style={styles.badgeCard}>
              <View style={[styles.badgeIcon, { backgroundColor: badge.color + '30' }]}>
                <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
              </View>
              <Text style={styles.badgeName}>{badge.name}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Recent Posts */}
        <Text style={styles.sectionTitle}>Recent Posts</Text>
        <View style={styles.postsContainer}>
          {RECENT_POSTS.map((post) => (
            <BlurView key={post.id} intensity={80} style={styles.postCard}>
              <View style={styles.postHeader}>
                <Text style={styles.postTopic}>{post.topic}</Text>
                <Text style={styles.postTime}>{post.time}</Text>
              </View>
              <Text style={styles.postContent}>{post.content}</Text>
              <View style={styles.postStats}>
                <View style={styles.postStat}>
                  <Ionicons name="heart-outline" size={18} color="#666" />
                  <Text style={styles.postStatText}>{post.likes}</Text>
                </View>
                <View style={styles.postStat}>
                  <Ionicons name="chatbubble-outline" size={18} color="#666" />
                  <Text style={styles.postStatText}>{post.comments}</Text>
                </View>
              </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    marginBottom: 20,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    marginHorizontal: 24,
    borderRadius: 30,
    padding: 30,
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileHeader: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    fontSize: 100,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  name: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  handle: {
    fontSize: 16,
    color: '#667eea',
    marginBottom: 12,
  },
  bio: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  location: {
    fontSize: 14,
    color: '#666',
  },
  dot: {
    color: '#999',
    marginHorizontal: 4,
  },
  joined: {
    fontSize: 14,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  followButton: {
    flex: 1,
    backgroundColor: '#667eea',
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: 'rgba(102,126,234,0.2)',
  },
  followText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  followingText: {
    color: '#667eea',
  },
  messageButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(102,126,234,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(102,126,234,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 24,
    marginTop: 24,
    marginBottom: 32,
  },
  statItem: {
    alignItems: 'center',
    position: 'relative',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
  },
  statDivider: {
    position: 'absolute',
    right: 0,
    top: 8,
    bottom: 8,
    width: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginLeft: 24,
    marginBottom: 16,
  },
  badgesContainer: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 8,
  },
  badgeCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 20,
    padding: 16,
    width: 120,
  },
  badgeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  badgeEmoji: {
    fontSize: 32,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  postsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  postCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  postTopic: {
    fontSize: 14,
    fontWeight: '700',
    color: '#667eea',
  },
  postTime: {
    fontSize: 13,
    color: '#999',
  },
  postContent: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    marginBottom: 16,
  },
  postStats: {
    flexDirection: 'row',
    gap: 24,
  },
  postStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postStatText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
});