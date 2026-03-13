import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const CONVERSATIONS = [
  {
    id: '1',
    user: { name: 'Jessica T.', avatar: '👩', status: 'online', lastSeen: 'now' },
    lastMessage: 'That sleep tip worked wonders! Thank you! 🙏',
    time: '2m ago',
    unread: 3,
    pinned: true,
  },
  {
    id: '2',
    user: { name: 'Parent Support Group', avatar: '👥', status: 'online', lastSeen: 'now', isGroup: true },
    lastMessage: 'Mike: We started solids yesterday!',
    time: '1h ago',
    unread: 12,
    pinned: true,
  },
  {
    id: '3',
    user: { name: 'Dr. Sarah', avatar: '👩‍⚕️', status: 'offline', lastSeen: '2h ago', verified: true },
    lastMessage: 'Make sure to keep hydrated during teething',
    time: '3h ago',
    unread: 0,
    pinned: false,
  },
  {
    id: '4',
    user: { name: 'Tom B.', avatar: '👨', status: 'online', lastSeen: 'now' },
    lastMessage: 'Same here! 18 month regression is real 😴',
    time: '5h ago',
    unread: 0,
    pinned: false,
  },
];

const MESSAGES = [
  { id: '1', text: 'Hey! How did the potty training go?', sender: 'them', time: '10:30 AM' },
  { id: '2', text: 'Amazing! We had our first accident-free day!', sender: 'me', time: '10:32 AM' },
  { id: '3', text: 'That sleep tip worked wonders! Thank you! 🙏', sender: 'them', time: '10:33 AM' },
];

export default function ChatScreen({ navigation }: any) {
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const renderConversation = ({ item }: { item: typeof CONVERSATIONS[0] }) => (
    <TouchableOpacity 
      style={styles.conversationItem}
      onPress={() => setActiveChat(item.id)}
    >
      <View style={styles.avatarContainer}>
        <Text style={styles.conversationAvatar}>{item.user.avatar}</Text>
        {item.user.status === 'online' && (
          <View style={styles.onlineIndicator} />
        )}
      </View>
      <View style={styles.conversationInfo}>
        <View style={styles.conversationHeader}>
          <View style={styles.nameContainer}>
            <Text style={styles.conversationName}>{item.user.name}</Text>
            {item.user.verified && (
              <Ionicons name="checkmark-circle" size={14} color="#667eea" />
            )}
            {item.user.isGroup && (
              <View style={styles.groupBadge}>
                <Text style={styles.groupText}>Group</Text>
              </View>
            )}
          </View>
          <Text style={styles.conversationTime}>{item.time}</Text>
        </View>
        <View style={styles.messageRow}>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage}
          </Text>
          {item.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (activeChat) {
    return (
      <LinearGradient colors={['#e0e7ff', '#d1d5ff', '#c7b8ff']} style={styles.container}>
        <StatusBar style="dark" />
        
        {/* Chat Header */}
        <BlurView intensity={90} style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setActiveChat(null)}>
            <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <View style={styles.chatHeaderInfo}>
            <Text style={styles.chatHeaderName}>Jessica T.</Text>
            <Text style={styles.chatHeaderStatus}>Active now</Text>
          </View>
          <TouchableOpacity>
            <Ionicons name="ellipsis-vertical" size={24} color="#667eea" />
          </TouchableOpacity>
        </BlurView>

        {/* Messages */}
        <FlatList
          data={MESSAGES}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          renderItem={({ item }) => (
            <View style={[
              styles.messageBubble,
              item.sender === 'me' ? styles.myMessage : styles.theirMessage
            ]}>
              <BlurView 
                intensity={item.sender === 'me' ? 100 : 80}
                style={[
                  styles.messageBlur,
                  item.sender === 'me' && { backgroundColor: '#667eea' }
                ]}
              >
                <Text style={[
                  styles.messageText,
                  item.sender === 'me' && styles.myMessageText
                ]}>
                  {item.text}
                </Text>
                <Text style={[
                  styles.messageTime,
                  item.sender === 'me' && styles.myMessageTime
                ]}>
                  {item.time}
                </Text>
              </BlurView>
            </View>
          )}
        />

        {/* Input */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <BlurView intensity={100} style={styles.chatInputContainer}>
            <TouchableOpacity style={styles.attachButton}>
              <Ionicons name="add-circle" size={28} color="#667eea" />
            </TouchableOpacity>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.chatInput}
                placeholder="Type a message..."
                placeholderTextColor="#999"
                value={message}
                onChangeText={setMessage}
                multiline
              />
            </View>
            <TouchableOpacity style={styles.sendButton}>
              <LinearGradient colors={['#667eea', '#764ba2']} style={styles.sendGradient}>
                <Ionicons name="send" size={20} color="white" />
              </LinearGradient>
            </TouchableOpacity>
          </BlurView>
        </KeyboardAvoidingView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#e0e7ff', '#d1d5ff', '#c7b8ff']} style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="#1a1a1a" />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Messages 💬</Text>
          <Text style={styles.subtitle}>3 new messages</Text>
        </View>
        <TouchableOpacity style={styles.newChatButton}>
          <BlurView intensity={80} style={styles.newChatBlur}>
            <Ionicons name="create-outline" size={24} color="#667eea" />
          </BlurView>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <BlurView intensity={80} style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor="#999"
        />
      </BlurView>

      {/* Conversations */}
      <FlatList
        data={CONVERSATIONS}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.conversationsList}
        showsVerticalScrollIndicator={false}
      />
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
    marginRight: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
  newChatButton: {
    marginLeft: 'auto',
    borderRadius: 16,
    overflow: 'hidden',
  },
  newChatBlur: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 20,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  conversationsList: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  conversationAvatar: {
    fontSize: 48,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#11998e',
    borderWidth: 2,
    borderColor: 'white',
  },
  conversationInfo: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  groupBadge: {
    backgroundColor: '#667eea20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  groupText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#667eea',
  },
  conversationTime: {
    fontSize: 12,
    color: '#999',
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 6,
  },
  // Chat View Styles
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  chatHeaderInfo: {
    alignItems: 'center',
  },
  chatHeaderName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  chatHeaderStatus: {
    fontSize: 13,
    color: '#11998e',
  },
  messagesList: {
    padding: 24,
    paddingBottom: 100,
  },
  messageBubble: {
    maxWidth: '75%',
    marginBottom: 16,
  },
  theirMessage: {
    alignSelf: 'flex-start',
  },
  myMessage: {
    alignSelf: 'flex-end',
  },
  messageBlur: {
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
  },
  messageText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
    marginBottom: 4,
  },
  myMessageText: {
    color: 'white',
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
    alignSelf: 'flex-end',
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.8)',
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 30,
  },
  attachButton: {
    marginRight: 12,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 24,
    paddingHorizontal: 16,
    maxHeight: 100,
  },
  chatInput: {
    fontSize: 16,
    color: '#333',
    paddingVertical: 12,
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  sendGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});