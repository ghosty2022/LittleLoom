import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
  Alert,
  ActivityIndicator,
  useColorScheme,
  Modal,
  ScrollView,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  FadeInUp, 
  FadeIn,
  SlideInRight,
  SlideInLeft,
  Layout,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  runOnJS,
  FadeInDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useFamilyChat, FamilyMessage, MessageType } from '../context/FamilyChatContext';
import { useFamily, FamilyMember } from '../context/FamilyContext';
import { useAuth } from '../context/AuthContext';
import { Audio } from 'expo-av';
import { format, isToday, isYesterday, isSameWeek } from 'date-fns';

type FamilyChatScreenProps = NativeStackScreenProps<RootStackParamList, 'FamilyChat'>;

const { width, height } = Dimensions.get('window');

// ==================== CONSTANTS ====================
const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🎉', '👏', '🔥'];
const QUICK_REPLIES = ['On my way!', 'Sounds good!', 'I love this!', 'Thanks for sharing'];

// ==================== SWEET ALERT COMPONENT ====================
const SweetAlertChat: React.FC<{
  visible: boolean;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  onClose: () => void;
}> = ({ visible, type, title, message, onClose }) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
  };

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 15 });
      opacity.value = withSpring(1);
      const timer = setTimeout(() => {
        scale.value = withSpring(0);
        opacity.value = withSpring(0, {}, () => runOnJS(onClose)());
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <View style={styles.alertOverlay}>
      <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.alertContainer, animatedStyle]}>
        <LinearGradient
          colors={[colors[type], `${colors[type]}dd`]}
          style={styles.alertGradient}
        >
          <Ionicons 
            name={type === 'success' ? 'checkmark-circle' : type === 'error' ? 'close-circle' : type === 'warning' ? 'warning' : 'information-circle'} 
            size={56} 
            color="#fff" 
          />
          <Text style={styles.alertTitle}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
          <TouchableOpacity style={styles.alertDismiss} onPress={onClose}>
            <Text style={styles.alertDismissText}>Tap to dismiss</Text>
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
    </View>
  );
};

// ==================== USER BUBBLE COMPONENT ====================
const UserBubble: React.FC<{
  member: FamilyMember;
  isSelected: boolean;
  onPress: () => void;
  isDark: boolean;
  showOnline?: boolean;
}> = ({ member, isSelected, onPress, isDark, showOnline = true }) => {
  const getRoleColor = () => {
    switch (member.role) {
      case 'parent1': return '#667eea';
      case 'parent2': return '#fa709a';
      case 'guardian': return '#11998e';
      default: return '#64748b';
    }
  };

  const getOnlineStatus = (): 'online' | 'away' | 'offline' => {
    if (!member.lastActive) return 'offline';
    const minutesSince = (Date.now() - new Date(member.lastActive).getTime()) / 1000 / 60;
    if (minutesSince < 5) return 'online';
    if (minutesSince < 30) return 'away';
    return 'offline';
  };

  const onlineStatus = getOnlineStatus();
  const statusColors = {
    online: '#10b981',
    away: '#f59e0b',
    offline: '#6b7280',
  };

  return (
    <TouchableOpacity 
      style={[styles.userBubble, isSelected && styles.userBubbleSelected]} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.userBubbleAvatar, { backgroundColor: `${getRoleColor()}20` }]}>
        <Text style={styles.userBubbleEmoji}>{member.avatar || '👤'}</Text>
        {showOnline && (
          <View style={[styles.userBubbleStatus, { backgroundColor: statusColors[onlineStatus] }]} />
        )}
      </View>
      <Text style={[styles.userBubbleName, isDark && styles.textDark]} numberOfLines={1}>
        {member.fullName.split(' ')[0]}
      </Text>
      <Text style={[styles.userBubbleRole, { color: getRoleColor() }]}>
        {member.role === 'parent1' ? 'Primary' : member.role === 'parent2' ? 'Co-Parent' : 'Guardian'}
      </Text>
      {isSelected && (
        <View style={styles.userBubbleCheck}>
          <Ionicons name="checkmark-circle" size={20} color="#667eea" />
        </View>
      )}
    </TouchableOpacity>
  );
};

// ==================== MESSAGE INFO MODAL ====================
const MessageInfoModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  message: FamilyMessage | null;
  isDark: boolean;
  members: FamilyMember[];
}> = ({ visible, onClose, message, isDark, members }) => {
  if (!message) return null;

  const sender = members.find(m => m.id === message.senderId);
  const readByMembers = message.readBy?.map(userId => 
    members.find(m => m.id === userId || m.userId === userId)
  ).filter(Boolean) as FamilyMember[] || [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} onPress={onClose}>
        <BlurView intensity={95} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        <Animated.View entering={FadeInUp.springify()} style={[styles.messageInfoModal, isDark && styles.messageInfoModalDark]}>
          <LinearGradient 
            colors={isDark ? ['rgba(40,40,45,0.98)', 'rgba(30,30,35,0.95)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.95)']} 
            style={StyleSheet.absoluteFill} 
          />
          
          <View style={styles.messageInfoHeader}>
            <View style={[styles.messageInfoIcon, { backgroundColor: '#667eea20' }]}>
              <Ionicons name="information-circle" size={32} color="#667eea" />
            </View>
            <Text style={[styles.messageInfoTitle, isDark && styles.textDark]}>Message Info</Text>
            <TouchableOpacity onPress={onClose} style={styles.messageInfoClose}>
              <Ionicons name="close" size={24} color={isDark ? '#fff' : '#64748b'} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.messageInfoContent}>
            <View style={styles.messageInfoSection}>
              <Text style={[styles.messageInfoLabel, isDark && styles.textMuted]}>Sent by</Text>
              <View style={styles.messageInfoUser}>
                <View style={[styles.messageInfoAvatar, { backgroundColor: '#667eea20' }]}>
                  <Text style={styles.messageInfoAvatarText}>{sender?.avatar || '👤'}</Text>
                </View>
                <View>
                  <Text style={[styles.messageInfoUserName, isDark && styles.textDark]}>
                    {sender?.fullName || message.senderName}
                  </Text>
                  <Text style={[styles.messageInfoUserRole, { color: '#667eea' }]}>
                    {sender?.role === 'parent1' ? 'Primary Parent' : 
                     sender?.role === 'parent2' ? 'Co-Parent' : 'Guardian'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.messageInfoSection}>
              <Text style={[styles.messageInfoLabel, isDark && styles.textMuted]}>Sent at</Text>
              <Text style={[styles.messageInfoValue, isDark && styles.textDark]}>
                {format(new Date(message.timestamp), 'MMMM d, yyyy • h:mm a')}
              </Text>
            </View>

            {message.isEdited && (
              <View style={styles.messageInfoSection}>
                <Text style={[styles.messageInfoLabel, isDark && styles.textMuted]}>Edited</Text>
                <Text style={[styles.messageInfoValue, isDark && styles.textDark]}>
                  {format(new Date(message.editedAt || message.timestamp), 'MMMM d, yyyy • h:mm a')}
                </Text>
              </View>
            )}

            <View style={styles.messageInfoSection}>
              <Text style={[styles.messageInfoLabel, isDark && styles.textMuted]}>
                Read by ({readByMembers.length})
              </Text>
              {readByMembers.length > 0 ? (
                readByMembers.map((member, index) => (
                  <View key={member.id} style={styles.readByItem}>
                    <View style={[styles.readByAvatar, { backgroundColor: '#10b98120' }]}>
                      <Text style={styles.readByAvatarText}>{member.avatar || '👤'}</Text>
                    </View>
                    <Text style={[styles.readByName, isDark && styles.textDark]}>{member.fullName}</Text>
                    <Ionicons name="checkmark-done" size={16} color="#10b981" />
                  </View>
                ))
              ) : (
                <Text style={[styles.messageInfoEmpty, isDark && styles.textMuted]}>Not read yet</Text>
              )}
            </View>

            {message.reactions && message.reactions.length > 0 && (
              <View style={styles.messageInfoSection}>
                <Text style={[styles.messageInfoLabel, isDark && styles.textMuted]}>Reactions</Text>
                <View style={styles.messageInfoReactions}>
                  {message.reactions.map((reaction, index) => (
                    <View key={index} style={styles.messageInfoReaction}>
                      <Text style={styles.messageInfoReactionEmoji}>{reaction.emoji}</Text>
                      <Text style={[styles.messageInfoReactionName, isDark && styles.textDark]}>
                        {reaction.userName}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

// ==================== DATE SEPARATOR COMPONENT ====================
const DateSeparator: React.FC<{ date: string; isDark: boolean }> = ({ date, isDark }) => {
  const getDateText = () => {
    const d = new Date(date);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    if (isSameWeek(d, new Date())) return format(d, 'EEEE');
    return format(d, 'MMMM d, yyyy');
  };

  return (
    <View style={styles.dateSeparator}>
      <View style={[styles.dateLine, isDark && styles.dateLineDark]} />
      <View style={[styles.dateBadge, isDark && styles.dateBadgeDark]}>
        <Text style={[styles.dateText, isDark && styles.textMuted]}>{getDateText()}</Text>
      </View>
      <View style={[styles.dateLine, isDark && styles.dateLineDark]} />
    </View>
  );
};

// ==================== TYPING INDICATOR COMPONENT ====================
const TypingIndicator: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const animate = () => {
      dot1.value = withSpring(1, { damping: 10 });
      setTimeout(() => {
        dot2.value = withSpring(1, { damping: 10 });
      }, 150);
      setTimeout(() => {
        dot3.value = withSpring(1, { damping: 10 });
      }, 300);
      setTimeout(() => {
        dot1.value = withSpring(0);
        dot2.value = withSpring(0);
        dot3.value = withSpring(0);
      }, 600);
    };

    animate();
    const interval = setInterval(animate, 1200);
    return () => clearInterval(interval);
  }, []);

  const dotStyle = (val: any) => useAnimatedStyle(() => ({
    transform: [{ translateY: val.value * -4 }],
    opacity: 0.4 + val.value * 0.6,
  }));

  return (
    <View style={[styles.typingBubble, isDark && styles.typingBubbleDark]}>
      <View style={styles.typingDots}>
        <Animated.View style={[styles.typingDot, { backgroundColor: isDark ? '#fff' : '#667eea' }, dotStyle(dot1)]} />
        <Animated.View style={[styles.typingDot, { backgroundColor: isDark ? '#fff' : '#667eea' }, dotStyle(dot2)]} />
        <Animated.View style={[styles.typingDot, { backgroundColor: isDark ? '#fff' : '#667eea' }, dotStyle(dot3)]} />
      </View>
    </View>
  );
};

// ==================== MESSAGE REACTIONS COMPONENT ====================
const MessageReactions: React.FC<{
  reactions: { emoji: string; userId: string; userName: string }[];
  isMe: boolean;
  onPress: (emoji: string) => void;
  isDark: boolean;
}> = ({ reactions, isMe, onPress, isDark }) => {
  if (!reactions?.length) return null;

  const grouped = reactions.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <View style={[styles.reactionsContainer, isMe ? styles.reactionsRight : styles.reactionsLeft]}>
      {Object.entries(grouped).map(([emoji, count]) => (
        <TouchableOpacity
          key={emoji}
          style={[styles.reactionChip, isDark && styles.reactionChipDark]}
          onPress={() => onPress(emoji)}
        >
          <Text style={styles.reactionEmoji}>{emoji}</Text>
          {count > 1 && <Text style={[styles.reactionCount, isDark && styles.textDark]}>{count}</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );
};

// ==================== MESSAGE BUBBLE COMPONENT ====================
const MessageBubble: React.FC<{
  message: FamilyMessage;
  isMe: boolean;
  isDark: boolean;
  member?: FamilyMember;
  showAvatar: boolean;
  onReaction: (emoji: string) => void;
  onReply: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onInfo: () => void;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
}> = ({
  message,
  isMe,
  isDark,
  member,
  showAvatar,
  onReaction,
  onReply,
  onDelete,
  onEdit,
  onInfo,
  isFirstInGroup,
  isLastInGroup,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    scale.value = withSpring(0.98, { damping: 20 });
    setShowActions(true);
    setTimeout(() => {
      scale.value = withSpring(1);
    }, 150);
  };

  const formatTime = (timestamp: string) => {
    return format(new Date(timestamp), 'h:mm a');
  };

  const getBubbleStyle = () => {
    if (message.type === 'system') return styles.systemBubble;
    if (isMe) {
      return [
        styles.myBubble,
        isFirstInGroup && styles.myBubbleFirst,
        isLastInGroup && styles.myBubbleLast,
      ];
    }
    return [
      styles.theirBubble,
      isFirstInGroup && styles.theirBubbleFirst,
      isLastInGroup && styles.theirBubbleLast,
    ];
  };

  const getRoleColor = () => {
    switch (message.senderRole) {
      case 'parent1': return '#667eea';
      case 'parent2': return '#fa709a';
      case 'guardian': return '#11998e';
      default: return '#64748b';
    }
  };

  return (
    <Animated.View
      entering={isMe ? SlideInRight : SlideInLeft}
      layout={Layout.springify()}
      style={[
        styles.messageContainer,
        isMe ? styles.myMessageContainer : styles.theirMessageContainer,
      ]}
    >
      {/* Avatar for group chats */}
      {!isMe && showAvatar && message.type !== 'system' && (
        <TouchableOpacity
          onPress={() => member && Alert.alert(member.fullName, `Role: ${member.role}`)}
          style={[styles.avatarSmall, { backgroundColor: getRoleColor() + '20' }]}
        >
          <Text style={styles.avatarEmoji}>{member?.avatar || '👤'}</Text>
        </TouchableOpacity>
      )}

      <View style={[!isMe && !showAvatar && { marginLeft: 44 }]}>
        {/* Sender name for group chats */}
        {!isMe && showAvatar && message.type !== 'system' && (
          <Text style={[styles.senderName, { color: getRoleColor() }]}>
            {message.senderName}
          </Text>
        )}

        <Animated.View style={animatedStyle}>
          <TouchableOpacity
            onLongPress={handleLongPress}
            activeOpacity={0.9}
            delayLongPress={200}
            onPress={onInfo}
          >
            <View style={[
              styles.bubble,
              getBubbleStyle(),
              isDark && !isMe && message.type !== 'system' && styles.bubbleDark,
            ]}>
              {/* Reply reference */}
              {message.replyTo && (
                <View style={[styles.replyPreview, isMe ? styles.replyPreviewMe : styles.replyPreviewThem]}>
                  <View style={[styles.replyLine, { backgroundColor: isMe ? 'rgba(255,255,255,0.5)' : '#667eea' }]} />
                  <View style={styles.replyContent}>
                    <Text style={[styles.replyName, isMe && styles.replyNameMe]} numberOfLines={1}>
                      {message.replyTo}
                    </Text>
                    <Text style={[styles.replyText, isMe && styles.replyTextMe]} numberOfLines={1}>
                      Replying to message...
                    </Text>
                  </View>
                </View>
              )}

              {/* Message content */}
              {message.type === 'image' && message.imageUrl ? (
                <TouchableOpacity onPress={() => {}}>
                  <Image source={{ uri: message.imageUrl }} style={styles.messageImage} />
                </TouchableOpacity>
              ) : message.type === 'voice' ? (
                <TouchableOpacity style={styles.voiceMessage}>
                  <Ionicons name="play" size={24} color={isMe ? '#fff' : '#667eea'} />
                  <View style={styles.waveform}>
                    {[...Array(20)].map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.waveformBar,
                          {
                            height: 10 + Math.random() * 20,
                            backgroundColor: isMe ? 'rgba(255,255,255,0.6)' : '#667eea',
                          },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.voiceDuration, isMe && styles.voiceDurationMe]}>0:24</Text>
                </TouchableOpacity>
              ) : (
                <Text style={[
                  styles.messageText,
                  isMe ? styles.myText : styles.theirText,
                  message.type === 'system' && styles.systemText,
                ]}>
                  {message.content}
                </Text>
              )}

              {/* Footer */}
              <View style={styles.messageFooter}>
                <Text style={[
                  styles.timestamp,
                  isMe ? styles.myTimestamp : styles.theirTimestamp,
                  message.type === 'system' && styles.systemTimestamp,
                ]}>
                  {formatTime(message.timestamp)}
                </Text>
                {message.isEdited && (
                  <Text style={[styles.editedLabel, isMe && styles.editedLabelMe]}>edited</Text>
                )}
                {isMe && message.type !== 'system' && (
                  <View style={styles.readStatus}>
                    {message.read ? (
                      <Ionicons name="checkmark-done" size={14} color="#34b7f1" />
                    ) : (
                      <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.7)" />
                    )}
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Reactions */}
        <MessageReactions
          reactions={message.reactions || []}
          isMe={isMe}
          onPress={onReaction}
          isDark={isDark}
        />
      </View>

      {/* Action Menu Modal */}
      <Modal
        visible={showActions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActions(false)}
      >
        <TouchableOpacity
          style={styles.actionOverlay}
          onPress={() => setShowActions(false)}
        >
          <BlurView intensity={90} style={styles.actionMenu} tint={isDark ? 'dark' : 'light'}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiRow}>
              {REACTIONS.map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.emojiButton}
                  onPress={() => {
                    onReaction(emoji);
                    setShowActions(false);
                  }}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionItem} onPress={() => { onReply(); setShowActions(false); }}>
                <View style={[styles.actionIcon, { backgroundColor: '#667eea20' }]}>
                  <Ionicons name="arrow-undo" size={20} color="#667eea" />
                </View>
                <Text style={[styles.actionText, isDark && styles.textDark]}>Reply</Text>
              </TouchableOpacity>

              {isMe && (
                <>
                  <TouchableOpacity style={styles.actionItem} onPress={() => { onEdit(); setShowActions(false); }}>
                    <View style={[styles.actionIcon, { backgroundColor: '#f59e0b20' }]}>
                      <Ionicons name="pencil" size={20} color="#f59e0b" />
                    </View>
                    <Text style={[styles.actionText, isDark && styles.textDark]}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionItem} onPress={() => { onDelete(); setShowActions(false); }}>
                    <View style={[styles.actionIcon, { backgroundColor: '#ff475720' }]}>
                      <Ionicons name="trash" size={20} color="#ff4757" />
                    </View>
                    <Text style={[styles.actionText, { color: '#ff4757' }]}>Delete</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity style={styles.actionItem} onPress={() => { onInfo(); setShowActions(false); }}>
                <View style={[styles.actionIcon, { backgroundColor: '#3b82f620' }]}>
                  <Ionicons name="information-circle" size={20} color="#3b82f6" />
                </View>
                <Text style={[styles.actionText, isDark && styles.textDark]}>Info</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionItem} onPress={() => setShowActions(false)}>
                <View style={[styles.actionIcon, { backgroundColor: '#10b98120' }]}>
                  <Ionicons name="copy" size={20} color="#10b981" />
                </View>
                <Text style={[styles.actionText, isDark && styles.textDark]}>Copy</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </TouchableOpacity>
      </Modal>
    </Animated.View>
  );
};

// ==================== REPLY PREVIEW COMPONENT ====================
const ReplyPreview: React.FC<{
  replyTo: { id: string; content: string; senderName: string } | null;
  onCancel: () => void;
  isDark: boolean;
}> = ({ replyTo, onCancel, isDark }) => {
  if (!replyTo) return null;

  return (
    <View style={[styles.replyBar, isDark && styles.replyBarDark]}>
      <View style={styles.replyBarContent}>
        <View style={styles.replyBarLine} />
        <View style={styles.replyBarText}>
          <Text style={[styles.replyBarName, isDark && styles.textDark]}>{replyTo.senderName}</Text>
          <Text style={[styles.replyBarPreview, isDark && styles.textMuted]} numberOfLines={1}>
            {replyTo.content}
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={onCancel} style={styles.replyBarClose}>
        <Ionicons name="close" size={20} color={isDark ? '#fff' : '#666'} />
      </TouchableOpacity>
    </View>
  );
};

// ==================== MAIN SCREEN ====================
export default function FamilyChatScreen({ navigation, route }: FamilyChatScreenProps) {
  const { chatId: initialChatId, memberId, memberName, memberAvatar } = route.params || {};
  const {
    getOrCreateDirectChat,
    getChatMessages,
    sendMessage,
    editMessage,
    markChatRead,
    deleteMessage,
    addReaction,
    setTypingStatus,
    isUserTyping,
    getChatById,
    pickAndSendImage,
    getTypingUsers,
  } = useFamilyChat();
  const { members } = useFamily();
  const { userProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [messages, setMessages] = useState<FamilyMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [chatId, setChatId] = useState<string>(initialChatId || '');
  const [chatInfo, setChatInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; senderName: string } | null>(null);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [showEmojiKeyboard, setShowEmojiKeyboard] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showUserBubbles, setShowUserBubbles] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<FamilyMessage | null>(null);
  const [showMessageInfo, setShowMessageInfo] = useState(false);
  
  // Sweet Alert state
  const [alert, setAlert] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({
    visible: false,
    type: 'success',
    title: '',
    message: '',
  });

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);

  // Initialize chat
  useEffect(() => {
    initializeChat();
  }, [initialChatId, memberId]);

  // Mark as read and setup polling
  useEffect(() => {
    if (!chatId) return;

    markChatRead(chatId);
    const interval = setInterval(() => {
      refreshMessages();
    }, 1000);

    return () => clearInterval(interval);
  }, [chatId]);

  const initializeChat = async () => {
    setIsLoading(true);
    let targetChatId = initialChatId;

    if (!targetChatId && memberId) {
      const member = members.find(m => m.id === memberId);
      targetChatId = await getOrCreateDirectChat(memberId, member);
    }

    if (targetChatId) {
      setChatId(targetChatId);
      const chat = getChatById(targetChatId);
      setChatInfo(chat);
      refreshMessages();
    }
    setIsLoading(false);
  };

  const refreshMessages = () => {
    if (!chatId) return;
    const msgs = getChatMessages(chatId);
    setMessages(msgs);
  };

  const showSweetAlert = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    setAlert({ visible: true, type, title, message });
  };

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !chatId) return;
    if (!userProfile) {
      showSweetAlert('error', 'Error', 'Please sign in to send messages');
      return;
    }

    const content = inputText.trim();
    setInputText('');

    if (editingMessage) {
      await editMessage(chatId, editingMessage, content);
      setEditingMessage(null);
      showSweetAlert('success', 'Updated!', 'Message has been edited successfully');
    } else {
      await sendMessage(chatId, content, 'text', undefined, replyingTo?.id);
    }

    setReplyingTo(null);
    setTypingStatus(chatId, false);
    refreshMessages();

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [inputText, chatId, userProfile, editingMessage, replyingTo, sendMessage, editMessage, setTypingStatus]);

  const handleInputChange = (text: string) => {
    setInputText(text);
    if (text.length > 0) {
      setTypingStatus(chatId, true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTypingStatus(chatId, false), 3000);
    } else {
      setTypingStatus(chatId, false);
    }
  };

  const handleImagePick = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await pickAndSendImage(chatId);
    refreshMessages();
    showSweetAlert('success', 'Photo Sent! 📷', 'Your image has been shared');
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    await addReaction(chatId, messageId, emoji);
    refreshMessages();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDelete = async (messageId: string) => {
    Alert.alert('Delete Message', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteMessage(chatId, messageId);
          refreshMessages();
          showSweetAlert('success', 'Deleted', 'Message has been removed');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const handleEdit = (message: FamilyMessage) => {
    setEditingMessage(message.id);
    setInputText(message.content);
    inputRef.current?.focus();
  };

  const handleReply = (message: FamilyMessage) => {
    setReplyingTo({
      id: message.id,
      content: message.content,
      senderName: message.senderName,
    });
    inputRef.current?.focus();
  };

  const handleMessageInfo = (message: FamilyMessage) => {
    setSelectedMessage(message);
    setShowMessageInfo(true);
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        showSweetAlert('error', 'Permission Needed', 'Microphone access is required for voice messages');
        return;
      }

      setIsRecording(true);
      setRecordingDuration(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      recordingInterval.current = setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
    } catch (error) {
      console.error('Recording error:', error);
    }
  };

  const stopRecording = async () => {
    if (recordingInterval.current) clearInterval(recordingInterval.current);
    setIsRecording(false);
    setRecordingDuration(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showSweetAlert('success', 'Voice Message', 'Voice message feature coming soon!');
    // TODO: Implement actual voice message sending
  };

  const getMemberById = (id: string): FamilyMember | undefined => {
    return members.find(m => m.id === id);
  };

  const getTypingText = () => {
    const typingUsers = getTypingUsers(chatId);
    const others = typingUsers.filter(u => u.userId !== userProfile?.id);
    if (!others.length) return '';
    if (others.length === 1) return `${others[0].userName} is typing...`;
    return `${others.length} people are typing...`;
  };

  const getHeaderInfo = () => {
    if (!chatInfo) {
      return { name: memberName || 'Chat', avatar: memberAvatar || '💬', status: '' };
    }

    if (chatInfo.type === 'group') {
      return {
        name: chatInfo.name || 'Family Group',
        avatar: chatInfo.avatar || '👨‍👩‍👧‍👦',
        status: `${chatInfo.participants?.length || 0} members`,
      };
    }

    const otherId = chatInfo.participants?.find((p: string) => p !== userProfile?.id);
    const member = otherId ? getMemberById(otherId) : undefined;

    return {
      name: member?.fullName || memberName || 'Unknown',
      avatar: member?.avatar || memberAvatar || '👤',
      status: member?.role === 'parent1' ? 'Primary Parent' :
        member?.role === 'parent2' ? 'Co-Parent' :
          member?.role === 'guardian' ? 'Guardian' : 'Family Member',
    };
  };

  const headerInfo = getHeaderInfo();
  const typingText = getTypingText();

  // Filter out current user from members for bubbles
  const otherMembers = useMemo(() => {
    return members.filter(m => m.id !== userProfile?.id && m.userId !== userProfile?.id);
  }, [members, userProfile]);

  const renderMessage = ({ item, index }: { item: FamilyMessage; index: number }) => {
    const isMe = item.senderId === userProfile?.id;
    const member = item.senderId !== 'system' ? getMemberById(item.senderId) : undefined;

    const prevMessage = messages[index - 1];
    const nextMessage = messages[index + 1];

    const isFirstInGroup = !prevMessage || prevMessage.senderId !== item.senderId || 
      new Date(item.timestamp).getTime() - new Date(prevMessage.timestamp).getTime() > 300000;
    const isLastInGroup = !nextMessage || nextMessage.senderId !== item.senderId ||
      new Date(nextMessage.timestamp).getTime() - new Date(item.timestamp).getTime() > 300000;

    const showDateSeparator = !prevMessage || 
      new Date(prevMessage.timestamp).toDateString() !== new Date(item.timestamp).toDateString();

    return (
      <View>
        {showDateSeparator && <DateSeparator date={item.timestamp} isDark={isDark} />}
        <MessageBubble
          message={item}
          isMe={isMe}
          isDark={isDark}
          member={member}
          showAvatar={isFirstInGroup}
          onReaction={(emoji) => handleReaction(item.id, emoji)}
          onReply={() => handleReply(item)}
          onDelete={() => handleDelete(item.id)}
          onEdit={() => handleEdit(item)}
          onInfo={() => handleMessageInfo(item)}
          isFirstInGroup={isFirstInGroup}
          isLastInGroup={isLastInGroup}
        />
      </View>
    );
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, isDark && styles.containerDark]}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* SweetAlert */}
      <SweetAlertChat
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onClose={() => setAlert(prev => ({ ...prev, visible: false }))}
      />

      {/* Message Info Modal */}
      <MessageInfoModal
        visible={showMessageInfo}
        onClose={() => setShowMessageInfo(false)}
        message={selectedMessage}
        isDark={isDark}
        members={members}
      />

      <LinearGradient
        colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8faff', '#e0e7ff']}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <BlurView intensity={90} style={[styles.header, { paddingTop: insets.top + 10 }]} tint={isDark ? 'dark' : 'light'}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerInfo}
          onPress={() => {
            if (chatInfo?.type === 'direct') {
              const otherId = chatInfo.participants?.find((p: string) => p !== userProfile?.id);
              if (otherId) navigation.navigate('EditGuardian', { guardianId: otherId });
            }
          }}
        >
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{headerInfo.avatar}</Text>
            {chatInfo?.type === 'direct' && (
              <View style={styles.onlineDot} />
            )}
          </View>
          <View>
            <Text style={[styles.headerName, isDark && styles.textDark]}>{headerInfo.name}</Text>
            <Text style={[styles.headerStatus, typingText && styles.typingStatus]}>
              {typingText || headerInfo.status}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={() => setShowUserBubbles(!showUserBubbles)}
          >
            <Ionicons name="people" size={22} color={showUserBubbles ? '#667eea' : (isDark ? '#fff' : '#1a1a1a')} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => {}}>
            <Ionicons name="videocam" size={22} color={isDark ? '#fff' : '#1a1a1a'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => {}}>
            <Ionicons name="call" size={22} color={isDark ? '#fff' : '#1a1a1a'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => {
              Alert.alert('Chat Options', '', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear Chat', style: 'destructive', onPress: () => {} },
                { text: 'Export Chat', onPress: () => {} },
              ]);
            }}
          >
            <Ionicons name="ellipsis-vertical" size={22} color={isDark ? '#fff' : '#1a1a1a'} />
          </TouchableOpacity>
        </View>
      </BlurView>

      {/* User Bubbles Row */}
      {showUserBubbles && (
        <Animated.View entering={FadeInDown} style={[styles.userBubblesContainer, { paddingTop: insets.top + 70 }]}>
          <BlurView intensity={90} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.userBubblesScroll}
          >
            {otherMembers.map((member, index) => (
              <Animated.View key={member.id} entering={FadeInRight.delay(index * 50)}>
                <UserBubble
                  member={member}
                  isSelected={false}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    // Navigate to member profile or start direct chat
                  }}
                  isDark={isDark}
                />
              </Animated.View>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.messagesList, 
          { paddingTop: showUserBubbles ? insets.top + 140 : insets.top + 80 }
        ]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
      />

      {/* Typing Indicator */}
      {typingText && (
        <View style={styles.typingContainer}>
          <TypingIndicator isDark={isDark} />
        </View>
      )}

      {/* Reply Preview */}
      <ReplyPreview replyTo={replyingTo} onCancel={() => setReplyingTo(null)} isDark={isDark} />

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Quick Replies */}
        {!inputText && !replyingTo && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickReplies}
          >
            {QUICK_REPLIES.map((reply, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.quickReply, isDark && styles.quickReplyDark]}
                onPress={() => {
                  setInputText(reply);
                  handleSend();
                }}
              >
                <Text style={[styles.quickReplyText, isDark && styles.textDark]}>{reply}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <BlurView intensity={100} style={styles.inputBar} tint={isDark ? 'dark' : 'light'}>
          <TouchableOpacity style={styles.inputButton} onPress={handleImagePick}>
            <Ionicons name="image" size={24} color="#667eea" />
          </TouchableOpacity>

          <View style={styles.inputWrapper}>
            <TextInput
              ref={inputRef}
              style={[styles.input, isDark && styles.inputDark]}
              placeholder={editingMessage ? 'Edit message...' : 'Type a message...'}
              placeholderTextColor={isDark ? '#666' : '#999'}
              value={inputText}
              onChangeText={handleInputChange}
              multiline
              maxLength={1000}
            />
          </View>

          {inputText ? (
            <TouchableOpacity
              style={[styles.sendButton, styles.sendButtonActive]}
              onPress={handleSend}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.inputButton}
              onPressIn={startRecording}
              onPressOut={stopRecording}
              delayLongPress={200}
            >
              <Ionicons name="mic" size={24} color={isRecording ? '#ff4757' : '#667eea'} />
            </TouchableOpacity>
          )}
        </BlurView>

        {/* Recording Overlay */}
        {isRecording && (
          <View style={styles.recordingOverlay}>
            <BlurView intensity={100} style={styles.recordingBar} tint="dark">
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>Recording {formatDuration(recordingDuration)}</Text>
              </View>
              <TouchableOpacity onPress={stopRecording} style={styles.recordingStop}>
                <Ionicons name="checkmark" size={24} color="#fff" />
              </TouchableOpacity>
            </BlurView>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  containerDark: { backgroundColor: '#0a0a0a' },
  centered: { justifyContent: 'center', alignItems: 'center' },

  // SweetAlert
  alertOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  alertContainer: {
    width: width * 0.85,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
  },
  alertGradient: {
    padding: 28,
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  alertDismiss: {
    marginTop: 8,
  },
  alertDismissText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },

  // User Bubbles
  userBubblesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 90,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  userBubblesScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  userBubble: {
    alignItems: 'center',
    width: 70,
  },
  userBubbleSelected: {
    opacity: 0.7,
  },
  userBubbleAvatar: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    position: 'relative',
  },
  userBubbleEmoji: {
    fontSize: 28,
  },
  userBubbleStatus: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  userBubbleName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  userBubbleRole: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  userBubbleCheck: {
    position: 'absolute',
    top: 0,
    right: 0,
  },

  // Message Info Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  messageInfoModal: {
    width: '100%',
    maxWidth: 380,
    maxHeight: height * 0.7,
    borderRadius: 28,
    padding: 24,
    overflow: 'hidden',
  },
  messageInfoModalDark: {
    backgroundColor: 'rgba(30,30,35,0.95)',
  },
  messageInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  messageInfoIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  messageInfoTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
  },
  messageInfoClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageInfoContent: {
    maxHeight: height * 0.5,
  },
  messageInfoSection: {
    marginBottom: 20,
  },
  messageInfoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageInfoUser: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageInfoAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  messageInfoAvatarText: {
    fontSize: 24,
  },
  messageInfoUserName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  messageInfoUserRole: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  messageInfoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  messageInfoEmpty: {
    fontSize: 14,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  readByItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  readByAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  readByAvatarText: {
    fontSize: 18,
  },
  readByName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  messageInfoReactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  messageInfoReaction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
  },
  messageInfoReactionEmoji: {
    fontSize: 20,
  },
  messageInfoReactionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(102,126,234,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
  },
  headerAvatarText: { fontSize: 24 },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#fff',
  },
  headerName: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  headerStatus: { fontSize: 13, color: '#64748b', marginTop: 2 },
  typingStatus: { color: '#11998e', fontStyle: 'italic' },
  headerActions: { flexDirection: 'row', gap: 4 },
  textDark: { color: '#fff' },
  textMuted: { color: '#94a3b8' },

  // Messages
  messagesList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    paddingHorizontal: 20,
  },
  dateLine: { flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.1)' },
  dateLineDark: { backgroundColor: 'rgba(255,255,255,0.1)' },
  dateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    marginHorizontal: 12,
  },
  dateBadgeDark: { backgroundColor: 'rgba(255,255,255,0.1)' },
  dateText: { fontSize: 12, color: '#64748b', fontWeight: '600' },

  // Message Bubble
  messageContainer: {
    marginBottom: 4,
    maxWidth: width * 0.78,
  },
  myMessageContainer: { alignSelf: 'flex-end', marginLeft: 60 },
  theirMessageContainer: { alignSelf: 'flex-start', marginRight: 60 },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 4,
  },
  avatarEmoji: { fontSize: 16 },
  senderName: { fontSize: 12, fontWeight: '600', marginBottom: 2, marginLeft: 4 },

  bubble: {
    padding: 12,
    borderRadius: 20,
  },
  myBubble: {
    backgroundColor: '#667eea',
    borderBottomRightRadius: 4,
  },
  myBubbleFirst: { borderBottomRightRadius: 4 },
  myBubbleLast: { borderBottomRightRadius: 20 },
  theirBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
      android: { elevation: 2 },
    }),
  },
  theirBubbleFirst: { borderBottomLeftRadius: 4 },
  theirBubbleLast: { borderBottomLeftRadius: 20 },
  bubbleDark: { backgroundColor: 'rgba(40,40,45,0.9)' },
  systemBubble: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignSelf: 'center',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },

  // Reply Preview in Bubble
  replyPreview: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 8,
  },
  replyPreviewMe: { backgroundColor: 'rgba(255,255,255,0.2)' },
  replyPreviewThem: { backgroundColor: 'rgba(102,126,234,0.1)' },
  replyLine: { width: 2, borderRadius: 1, marginRight: 8 },
  replyContent: { flex: 1 },
  replyName: { fontSize: 12, fontWeight: '600', color: '#667eea', marginBottom: 2 },
  replyNameMe: { color: 'rgba(255,255,255,0.8)' },
  replyText: { fontSize: 12, color: '#64748b' },
  replyTextMe: { color: 'rgba(255,255,255,0.6)' },

  // Message Content
  messageText: { fontSize: 16, lineHeight: 22 },
  myText: { color: '#fff' },
  theirText: { color: '#1a1a1a' },
  systemText: { color: '#64748b', fontSize: 13, fontStyle: 'italic' },
  messageImage: {
    width: width * 0.6,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
  },
  voiceMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 12,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 30,
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
  },
  voiceDuration: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  voiceDurationMe: { color: 'rgba(255,255,255,0.8)' },

  // Footer
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  timestamp: { fontSize: 11 },
  myTimestamp: { color: 'rgba(255,255,255,0.7)' },
  theirTimestamp: { color: '#94a3b8' },
  systemTimestamp: { color: '#94a3b8' },
  editedLabel: { fontSize: 10, color: '#94a3b8', fontStyle: 'italic' },
  editedLabelMe: { color: 'rgba(255,255,255,0.6)' },
  readStatus: { marginLeft: 2 },

  // Reactions
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  reactionsLeft: { marginLeft: 40 },
  reactionsRight: { justifyContent: 'flex-end' },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
      android: { elevation: 2 },
    }),
  },
  reactionChipDark: { backgroundColor: 'rgba(40,40,45,0.9)' },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 11, marginLeft: 2, color: '#64748b', fontWeight: '600' },

  // Action Menu
  actionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionMenu: {
    width: width - 40,
    borderRadius: 24,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  emojiRow: {
    flexDirection: 'row',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  emojiButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  emojiText: { fontSize: 28 },
  actionButtons: { marginTop: 12 },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionText: { fontSize: 16, color: '#1a1a1a', fontWeight: '500' },

  // Typing
  typingContainer: {
    marginLeft: 16,
    marginBottom: 8,
  },
  typingBubble: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    padding: 12,
    alignSelf: 'flex-start',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
      android: { elevation: 2 },
    }),
  },
  typingBubbleDark: { backgroundColor: 'rgba(40,40,45,0.9)' },
  typingDots: { flexDirection: 'row', gap: 4, alignItems: 'center', height: 20 },
  typingDot: { width: 6, height: 6, borderRadius: 3 },

  // Reply Bar
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  replyBarDark: { backgroundColor: 'rgba(30,30,35,0.9)', borderTopColor: 'rgba(255,255,255,0.1)' },
  replyBarContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  replyBarLine: { width: 4, height: 36, backgroundColor: '#667eea', borderRadius: 2, marginRight: 12 },
  replyBarText: { flex: 1 },
  replyBarName: { fontSize: 13, fontWeight: '600', color: '#667eea', marginBottom: 2 },
  replyBarPreview: { fontSize: 13, color: '#64748b' },
  replyBarClose: { padding: 4 },

  // Quick Replies
  quickReplies: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  quickReply: {
    backgroundColor: 'rgba(102,126,234,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.2)',
  },
  quickReplyDark: { backgroundColor: 'rgba(102,126,234,0.2)', borderColor: 'rgba(102,126,234,0.3)' },
  quickReplyText: { fontSize: 14, color: '#667eea', fontWeight: '500' },

  // Input
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 10,
  },
  inputButton: { padding: 8 },
  inputWrapper: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    marginHorizontal: 8,
  },
  input: { fontSize: 16, color: '#1a1a1a', maxHeight: 80 },
  inputDark: { color: '#fff' },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(102,126,234,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: { backgroundColor: '#667eea' },

  // Recording
  recordingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  recordingIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff4757',
  },
  recordingText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  recordingStop: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
});