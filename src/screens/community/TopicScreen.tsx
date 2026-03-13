import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const POSTS = [
  {
    id: '1',
    author: { name: 'NewParent42', avatar: '👨', verified: false },
    content: 'Day 3 of potty training and we\'re struggling with nighttime. Any tips?',
    likes: 23,
    comments: 15,
    time: '30m ago',
  },
  {
    id: '2',
    author: { name: 'Dr. Sarah', avatar: '👩‍⚕️', verified: true },
    content: 'Remember: every child is different. Don\'t compare your journey to others! 💙',
    likes: 892,
    comments: 45,
    time: '2h ago',
  },
  {
    id: '3',
    author: { name: 'MomOfThree', avatar: '👩', verified: false },
    content: 'We used the sticker chart method and it worked wonders! Here\'s our template...',
    likes: 156,
    comments: 32,
    time: '4h ago',
  },
];

export default function TopicScreen({ navigation, route }: any) {
  const { topic } = route.params;
  const [joined, setJoined] = useState(false);

  return (
    <LinearGradient colors={['#e0e7ff', '#d1d5ff', '#c7b8ff']} style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header Background */}
      <LinearGradient 
        colors={[topic.color + '60', topic.color + '20', 'transparent']}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color="#1a1a1a" />
          </TouchableOpacity>
          <TouchableOpacity>
            <Ionicons name="ellipsis-horizontal" size={24} color="#1a1a1a" />
          </TouchableOpacity>
        </View>

        {/* Topic Info */}
        <View style={styles.topicInfo}>
          <Text style={styles.topicEmoji}>{topic.emoji}</Text>
          <Text style={styles.topicName}>{topic.name}</Text>
          <View style={styles.topicStats}>
            <Text style={styles.stat}>{topic.members} members</Text>
            <Text style={styles.statDot}>•</Text>
            <Text style={styles.stat}>{topic.posts} posts today</Text>
          </View>
          <TouchableOpacity 
            style={[styles.joinButton, joined && styles.joinedButton]}
            onPress={() => setJoined(!joined)}
          >
            <Text style={[styles.joinText, joined && styles.joinedText]}>
              {joined ? 'Joined ✓' : 'Join Topic'}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Content */}
      <View style={styles.content}>
        {/* Sort Options */}
        <View style={styles.sortContainer}>
          <TouchableOpacity style={styles.sortButton}>
            <Text style={styles.sortText}>Trending</Text>
            <Ionicons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterButton}>
            <Ionicons name="funnel-outline" size={20} color="#667eea" />
          </TouchableOpacity>
        </View>

        {/* Posts */}
        <FlatList
          data={POSTS}
          renderItem={({ item }) => (
            <BlurView intensity={80} style={styles.postCard}>
              <View style={styles.postHeader}>
                <Text style={styles.postAvatar}>{item.author.avatar}</Text>
                <View>
                  <View style={styles.postNameRow}>
                    <Text style={styles.postAuthor}>{item.author.name}</Text>
                    {item.author.verified && (
                      <Ionicons name="checkmark-circle" size={14} color="#667eea" />
                    )}
                  </View>
                  <Text style={styles.postTime}>{item.time}</Text>
                </View>
              </View>
              <Text style={styles.postContent}>{item.content}</Text>
              <View style={styles.postActions}>
                <TouchableOpacity style={styles.action}>
                  <Ionicons name="heart-outline" size={20} color="#666" />
                  <Text style={styles.actionText}>{item.likes}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.action}>
                  <Ionicons name="chatbubble-outline" size={20} color="#666" />
                  <Text style={styles.actionText}>{item.comments}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.action}>
                  <Ionicons name="share-outline" size={20} color="#666" />
                </TouchableOpacity>
              </View>
            </BlurView>
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.postsList}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Floating Post Button */}
      <TouchableOpacity style={styles.fab}>
        <LinearGradient colors={[topic.color, topic.color + 'aa']} style={styles.fabGradient}>
          <Ionicons name="create-outline" size={28} color="white" />
        </LinearGradient>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  topicInfo: {
    alignItems: 'center',
  },
  topicEmoji: {
    fontSize: 80,
    marginBottom: 12,
  },
  topicName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  topicStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  stat: {
    fontSize: 14,
    color: '#666',
  },
  statDot: {
    marginHorizontal: 8,
    color: '#999',
  },
  joinButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  joinedButton: {
    backgroundColor: 'rgba(102,126,234,0.2)',
  },
  joinText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  joinedText: {
    color: '#667eea',
  },
  content: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 20,
  },
  sortContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sortText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postsList: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  postCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  postAvatar: {
    fontSize: 40,
    marginRight: 12,
  },
  postNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postAuthor: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  postTime: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  postContent: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    marginBottom: 16,
  },
  postActions: {
    flexDirection: 'row',
    gap: 24,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  fabGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});