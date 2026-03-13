import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  useAnimatedStyle, 
  withSpring,
  interpolate,
} from 'react-native-reanimated';

const REPLIES = [
  {
    id: '1',
    author: { name: 'Jessica T.', avatar: '👩', verified: true },
    content: 'This is exactly what we needed! Trying this tonight. 🙏',
    likes: 45,
    time: '1h ago',
    replies: [
      {
        id: 'r1',
        author: { name: 'Sarah M.', avatar: '👩', verified: true },
        content: 'Let me know how it goes! Rooting for you 💪',
        likes: 12,
        time: '45m ago',
      },
    ],
  },
  {
    id: '2',
    author: { name: 'Mike D.', avatar: '👨', verified: false },
    content: 'We had the same experience! Consistency is key 🔑',
    likes: 23,
    time: '3h ago',
    replies: [],
  },
];

export default function PostDetailScreen({ navigation, route }: any) {
  const [comment, setComment] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [isReposted, setIsReposted] = useState(false);
  const [likes, setLikes] = useState(342);
  const [reposts, setReposts] = useState(89);
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(scrollY.value, [0, 100], [0, 1]),
    };
  });

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikes(isLiked ? likes - 1 : likes + 1);
  };

  const handleRepost = () => {
    setIsReposted(!isReposted);
    setReposts(isReposted ? reposts - 1 : reposts + 1);
  };

  const renderReply = ({ item }: { item: typeof REPLIES[0] }) => (
    <View style={styles.replyContainer}>
      <View style={styles.replyLine} />
      <BlurView intensity={60} style={styles.replyCard}>
        <View style={styles.replyHeader}>
          <Text style={styles.replyAvatar}>{item.author.avatar}</Text>
          <View>
            <View style={styles.replyNameRow}>
              <Text style={styles.replyName}>{item.author.name}</Text>
              {item.author.verified && (
                <Ionicons name="checkmark-circle" size={14} color="#667eea" />
              )}
            </View>
            <Text style={styles.replyTime}>{item.time}</Text>
          </View>
        </View>
        <Text style={styles.replyContent}>{item.content}</Text>
        <View style={styles.replyActions}>
          <TouchableOpacity style={styles.replyAction}>
            <Ionicons name="heart-outline" size={18} color="#666" />
            <Text style={styles.replyActionText}>{item.likes}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.replyAction}>
            <Ionicons name="chatbubble-outline" size={18} color="#666" />
            <Text style={styles.replyActionText}>Reply</Text>
          </TouchableOpacity>
        </View>

        {/* Nested Replies */}
        {item.replies.map((nested) => (
          <View key={nested.id} style={styles.nestedReply}>
            <View style={styles.nestedLine} />
            <View style={styles.nestedContent}>
              <View style={styles.replyHeader}>
                <Text style={styles.nestedAvatar}>{nested.author.avatar}</Text>
                <View>
                  <View style={styles.replyNameRow}>
                    <Text style={styles.replyName}>{nested.author.name}</Text>
                    {nested.author.verified && (
                      <Ionicons name="checkmark-circle" size={14} color="#667eea" />
                    )}
                  </View>
                  <Text style={styles.replyTime}>{nested.time}</Text>
                </View>
              </View>
              <Text style={styles.replyContent}>{nested.content}</Text>
            </View>
          </View>
        ))}
      </BlurView>
    </View>
  );

  return (
    <LinearGradient colors={['#e0e7ff', '#d1d5ff', '#c7b8ff']} style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Animated Header */}
      <Animated.View style={[styles.animatedHeader, headerStyle]}>
        <BlurView intensity={90} style={styles.headerBlur}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thread</Text>
          <TouchableOpacity>
            <Ionicons name="share-outline" size={24} color="#667eea" />
          </TouchableOpacity>
        </BlurView>
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
        >
          {/* Original Post */}
          <BlurView intensity={90} style={styles.originalPost}>
            <View style={styles.postHeader}>
              <View style={styles.authorInfo}>
                <Text style={styles.authorAvatar}>👩</Text>
                <View>
                  <View style={styles.nameRow}>
                    <Text style={styles.authorName}>Sarah M.</Text>
                    <Ionicons name="checkmark-circle" size={16} color="#667eea" />
                  </View>
                  <Text style={styles.postMeta}>in Potty Training • 2h ago</Text>
                </View>
              </View>
              <TouchableOpacity>
                <Ionicons name="ellipsis-horizontal" size={20} color="#999" />
              </TouchableOpacity>
            </View>

            <Text style={styles.postContent}>
              Just had our first accident-free day! 🎉 The 3-day method really works. Here's what worked for us...
              {'\n\n'}
              1. Consistency is key 🔑{'\n'}
              2. Positive reinforcement works wonders ✨{'\n'}
              3. Don't stress about accidents - they happen! 💪
            </Text>

            <View style={styles.postStats}>
              <Text style={styles.statText}>{likes} likes • {reposts} reposts • 56 replies</Text>
            </View>

            <View style={styles.postActions}>
              <TouchableOpacity 
                style={[styles.actionButton, isLiked && styles.actionActive]}
                onPress={handleLike}
              >
                <Ionicons 
                  name={isLiked ? "heart" : "heart-outline"} 
                  size={24} 
                  color={isLiked ? "#fc5c7d" : "#666"} 
                />
                <Text style={[styles.actionText, isLiked && styles.actionTextActive]}>
                  Like
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="chatbubble-outline" size={22} color="#666" />
                <Text style={styles.actionText}>Reply</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionButton, isReposted && styles.actionActive]}
                onPress={handleRepost}
              >
                <Ionicons 
                  name={isReposted ? "repeat" : "repeat-outline"} 
                  size={22} 
                  color={isReposted ? "#11998e" : "#666"} 
                />
                <Text style={[styles.actionText, isReposted && styles.actionTextActive]}>
                  Repost
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="bookmark-outline" size={22} color="#666" />
              </TouchableOpacity>
            </View>
          </BlurView>

          {/* Replies Section */}
          <Text style={styles.repliesTitle}>Replies ({REPLIES.length})</Text>
          <FlatList
            data={REPLIES}
            renderItem={renderReply}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={styles.repliesList}
          />
        </ScrollView>

        {/* Comment Input */}
        <BlurView intensity={100} style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputAvatar}>👩</Text>
            <TextInput
              style={styles.input}
              placeholder="Write a reply..."
              placeholderTextColor="#999"
              value={comment}
              onChangeText={setComment}
              multiline
            />
            <TouchableOpacity 
              style={[styles.sendButton, comment.length > 0 && styles.sendButtonActive]}
              disabled={comment.length === 0}
            >
              <Ionicons 
                name="send" 
                size={20} 
                color={comment.length > 0 ? "white" : "#999"} 
              />
            </TouchableOpacity>
          </View>
        </BlurView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  animatedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  headerBlur: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  keyboardView: {
    flex: 1,
  },
  originalPost: {
    margin: 24,
    marginTop: 60,
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorAvatar: {
    fontSize: 48,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  postMeta: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  postContent: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    marginBottom: 16,
  },
  postStats: {
    marginBottom: 16,
  },
  statText: {
    fontSize: 14,
    color: '#999',
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  repliesTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginLeft: 24,
    marginBottom: 16,
  },
  repliesList: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  replyContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  replyLine: {
    width: 2,
    backgroundColor: 'rgba(102,126,234,0.2)',
    marginRight: 16,
    marginLeft: 24,
    borderRadius: 1,
  },
  replyCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  replyAvatar: {
    fontSize: 32,
    marginRight: 10,
  },
  replyNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  replyName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  replyTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  replyContent: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
    marginBottom: 12,
    marginLeft: 42,
  },
  replyActions: {
    flexDirection: 'row',
    gap: 16,
    marginLeft: 42,
  },
  replyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  replyActionText: {
    fontSize: 13,
    color: '#666',
  },
  nestedReply: {
    flexDirection: 'row',
    marginTop: 12,
    marginLeft: 42,
  },
  nestedLine: {
    width: 2,
    backgroundColor: 'rgba(102,126,234,0.1)',
    marginRight: 12,
  },
  nestedContent: {
    flex: 1,
  },
  nestedAvatar: {
    fontSize: 24,
    marginRight: 8,
  },
  inputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 30,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputAvatar: {
    fontSize: 32,
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    maxHeight: 100,
    paddingTop: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(102,126,234,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#667eea',
  },
});