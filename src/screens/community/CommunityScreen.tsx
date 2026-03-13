import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  interpolate,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const TOPICS = [
  { 
    id: '1', 
    name: 'Potty Training', 
    emoji: '🚽', 
    color: '#667eea',
    members: '12.5k',
    posts: '3.2k',
    trending: true,
  },
  { 
    id: '2', 
    name: 'Sleep Tips', 
    emoji: '😴', 
    color: '#11998e',
    members: '18.2k',
    posts: '5.1k',
    trending: true,
  },
  { 
    id: '3', 
    name: 'Feeding & Nutrition', 
    emoji: '🍼', 
    color: '#fa709a',
    members: '15.8k',
    posts: '4.7k',
    trending: false,
  },
  { 
    id: '4', 
    name: 'Milestones', 
    emoji: '🏆', 
    color: '#fee140',
    members: '9.3k',
    posts: '2.1k',
    trending: false,
  },
  { 
    id: '5', 
    name: 'Health & Wellness', 
    emoji: '💊', 
    color: '#fc5c7d',
    members: '11.7k',
    posts: '3.8k',
    trending: true,
  },
  { 
    id: '6', 
    name: 'Parenting Hacks', 
    emoji: '💡', 
    color: '#6a82fb',
    members: '22.4k',
    posts: '8.9k',
    trending: true,
  },
];

const FEATURED_POSTS = [
  {
    id: '1',
    author: {
      name: 'Sarah M.',
      avatar: '👩',
      verified: true,
    },
    topic: 'Potty Training',
    content: 'Just had our first accident-free day! 🎉 The 3-day method really works. Here\'s what worked for us...',
    image: null,
    likes: 342,
    comments: 56,
    reposts: 89,
    time: '2h ago',
    isLiked: false,
    isReposted: false,
  },
  {
    id: '2',
    author: {
      name: 'Mike D.',
      avatar: '👨',
      verified: false,
    },
    topic: 'Sleep Tips',
    content: 'Anyone else dealing with the 18-month sleep regression? 😴 We were sleeping through the night and now...',
    image: null,
    likes: 567,
    comments: 124,
    reposts: 45,
    time: '4h ago',
    isLiked: true,
    isReposted: false,
  },
  {
    id: '3',
    author: {
      name: 'Emma W.',
      avatar: '👩‍⚕️',
      verified: true,
    },
    topic: 'Feeding & Nutrition',
    content: 'Homemade baby food batch prep for the win! 🥕 Here\'s my weekly meal prep routine that saves me 5 hours...',
    image: '🥦',
    likes: 892,
    comments: 203,
    reposts: 445,
    time: '6h ago',
    isLiked: false,
    isReposted: true,
  },
];

const ONLINE_USERS = [
  { id: '1', name: 'Jessica', avatar: '👩', status: 'online' },
  { id: '2', name: 'David', avatar: '👨', status: 'online' },
  { id: '3', name: 'Maria', avatar: '👩‍⚕️', status: 'in-chat' },
  { id: '4', name: 'Tom', avatar: '👨‍💼', status: 'online' },
  { id: '5', name: 'Lisa', avatar: '👩‍🍳', status: 'online' },
];

export default function CommunityScreen({ navigation }: any) {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('trending');
  const scrollY = useSharedValue(0);

  const headerStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(scrollY.value, [0, 100], [1, 0.9]),
      transform: [
        {
          scale: interpolate(scrollY.value, [0, 100], [1, 0.95]),
        },
      ],
    };
  });

  useFocusEffect(
    useCallback(() => {
      // Refresh data when focused
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  const renderTopicCard = ({ item }: { item: typeof TOPICS[0] }) => (
    <TouchableOpacity 
      style={styles.topicCard}
      onPress={() => navigation.navigate('Topic', { topic: item })}
    >
      <LinearGradient
        colors={[item.color + '40', item.color + '20']}
        style={styles.topicGradient}
      >
        <View style={styles.topicHeader}>
          <Text style={styles.topicEmoji}>{item.emoji}</Text>
          {item.trending && (
            <View style={styles.trendingBadge}>
              <Text style={styles.trendingText}>🔥</Text>
            </View>
          )}
        </View>
        <Text style={styles.topicName}>{item.name}</Text>
        <View style={styles.topicStats}>
          <Text style={styles.topicStat}>{item.members} members</Text>
          <Text style={styles.topicDot}>•</Text>
          <Text style={styles.topicStat}>{item.posts} posts</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderPost = ({ item }: { item: typeof FEATURED_POSTS[0] }) => (
    <BlurView intensity={80} style={styles.postCard}>
      {/* Post Header */}
      <View style={styles.postHeader}>
        <View style={styles.authorInfo}>
          <Text style={styles.authorAvatar}>{item.author.avatar}</Text>
          <View>
            <View style={styles.nameRow}>
              <Text style={styles.authorName}>{item.author.name}</Text>
              {item.author.verified && (
                <Ionicons name="checkmark-circle" size={16} color="#667eea" />
              )}
            </View>
            <Text style={styles.postMeta}>
              in {item.topic} • {item.time}
            </Text>
          </View>
        </View>
        <TouchableOpacity>
          <Ionicons name="ellipsis-horizontal" size={20} color="#999" />
        </TouchableOpacity>
      </View>

      {/* Post Content */}
      <Text style={styles.postContent}>{item.content}</Text>
      {item.image && (
        <View style={styles.postImageContainer}>
          <Text style={styles.postImage}>{item.image}</Text>
        </View>
      )}

      {/* Post Actions */}
      <View style={styles.postActions}>
        <TouchableOpacity style={[styles.actionButton, item.isLiked && styles.actionActive]}>
          <Ionicons 
            name={item.isLiked ? "heart" : "heart-outline"} 
            size={22} 
            color={item.isLiked ? "#fc5c7d" : "#666"} 
          />
          <Text style={[styles.actionText, item.isLiked && styles.actionTextActive]}>
            {item.likes}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="chatbubble-outline" size={20} color="#666" />
          <Text style={styles.actionText}>{item.comments}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, item.isReposted && styles.actionActive]}>
          <Ionicons 
            name={item.isReposted ? "repeat" : "repeat-outline"} 
            size={20} 
            color={item.isReposted ? "#11998e" : "#666"} 
          />
          <Text style={[styles.actionText, item.isReposted && styles.actionTextActive]}>
            {item.reposts}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="share-outline" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    </BlurView>
  );

  return (
    <LinearGradient colors={['#e0e7ff', '#d1d5ff', '#c7b8ff']} style={styles.container}>
      <StatusBar style="dark" />
      
      <Animated.View style={[styles.animatedHeader, headerStyle]}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Community 👥</Text>
            <Text style={styles.subtitle}>Connect with 50k+ parents</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => navigation.navigate('Notifications')}
            >
              <BlurView intensity={80} style={styles.iconBlur}>
                <Ionicons name="notifications-outline" size={24} color="#667eea" />
                <View style={styles.notificationBadge}>
                  <Text style={styles.badgeText}>3</Text>
                </View>
              </BlurView>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => navigation.navigate('Chat')}
            >
              <BlurView intensity={80} style={styles.iconBlur}>
                <Ionicons name="chatbubbles-outline" size={24} color="#667eea" />
              </BlurView>
            </TouchableOpacity>
          </View>
        </View>

        {/* Online Users Strip */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.onlineContainer}
        >
          <TouchableOpacity style={styles.createRoomButton}>
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.createRoomGradient}>
              <Ionicons name="add" size={24} color="white" />
              <Text style={styles.createRoomText}>Room</Text>
            </LinearGradient>
          </TouchableOpacity>
          {ONLINE_USERS.map((user) => (
            <TouchableOpacity key={user.id} style={styles.onlineUser}>
              <View style={styles.onlineAvatarContainer}>
                <Text style={styles.onlineAvatar}>{user.avatar}</Text>
                <View style={[
                  styles.statusDot, 
                  { backgroundColor: user.status === 'online' ? '#11998e' : '#667eea' }
                ]} />
              </View>
              <Text style={styles.onlineName}>{user.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" />
        }
        onScroll={(event) => {
          scrollY.value = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        {/* Topics Grid */}
        <Text style={styles.sectionTitle}>Popular Topics</Text>
        <FlatList
          data={TOPICS}
          renderItem={renderTopicCard}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topicsContainer}
        />

        {/* Feed Tabs */}
        <View style={styles.tabContainer}>
          {['trending', 'following', 'nearby'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive
              ]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
              {activeTab === tab && (
                <View style={styles.tabIndicator}>
                  <LinearGradient
                    colors={['#667eea', '#764ba2']}
                    style={styles.tabGradient}
                  />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Featured Posts */}
        <View style={styles.feedContainer}>
          {FEATURED_POSTS.map((post) => (
            <View key={post.id}>
              {renderPost({ item: post })}
            </View>
          ))}
        </View>

        {/* Load More */}
        <TouchableOpacity style={styles.loadMore}>
          <Text style={styles.loadMoreText}>Load more posts</Text>
          <Ionicons name="chevron-down" size={20} color="#667eea" />
        </TouchableOpacity>
      </ScrollView>

      {/* Floating Create Post Button */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('CreatePost')}
      >
        <LinearGradient colors={['#fa709a', '#fee140']} style={styles.fabGradient}>
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
  animatedHeader: {
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  iconBlur: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
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
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  onlineContainer: {
    paddingVertical: 16,
    gap: 16,
  },
  createRoomButton: {
    borderRadius: 28,
    overflow: 'hidden',
    marginRight: 8,
  },
  createRoomGradient: {
    width: 56,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createRoomText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  onlineUser: {
    alignItems: 'center',
    marginRight: 16,
  },
  onlineAvatarContainer: {
    position: 'relative',
    marginBottom: 6,
  },
  onlineAvatar: {
    fontSize: 48,
  },
  statusDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'white',
  },
  onlineName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginLeft: 24,
    marginBottom: 16,
    marginTop: 8,
  },
  topicsContainer: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 8,
  },
  topicCard: {
    width: 160,
    height: 140,
    borderRadius: 24,
    overflow: 'hidden',
    marginRight: 12,
  },
  topicGradient: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  topicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  topicEmoji: {
    fontSize: 40,
  },
  trendingBadge: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    padding: 6,
  },
  trendingText: {
    fontSize: 12,
  },
  topicName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  topicStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topicStat: {
    fontSize: 12,
    color: '#666',
  },
  topicDot: {
    marginHorizontal: 6,
    color: '#999',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 16,
    gap: 24,
  },
  tab: {
    paddingVertical: 8,
  },
  tabActive: {},
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
  },
  tabTextActive: {
    color: '#1a1a1a',
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  tabGradient: {
    flex: 1,
  },
  feedContainer: {
    paddingHorizontal: 24,
    gap: 16,
  },
  postCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorAvatar: {
    fontSize: 40,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  postMeta: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  postContent: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    marginBottom: 12,
  },
  postImageContainer: {
    backgroundColor: 'rgba(102,126,234,0.1)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  postImage: {
    fontSize: 60,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  actionActive: {},
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  actionTextActive: {
    color: '#667eea',
  },
  loadMore: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  loadMoreText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
    marginBottom: 8,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 120,
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#fa709a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  fabGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});