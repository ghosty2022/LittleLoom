// src/screens/community/CommunityScreen.tsx
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeInUp,
  FadeOut,
  interpolate,
  interpolateColor,
  Layout,
  runOnJS,
  SlideInDown,
  SlideOutUp,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCommunity, INITIAL_TOPICS } from '../../context/CommunityContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  CommunityColors,
} from '../../theme/CommunityTheme';
import type { CommunityStackParamList } from '../../types/navigation';
import type { Post, PostMood, Poll, CommunityUser } from '../../context/CommunityContext';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useAuth } from '../../context/AuthContext';
import { useRouteBasedNavVisibility } from '../../hooks/useRouteBasedNavVisibility';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { useUser } from '../../context/UserContext';
import { VideoView, useVideoPlayer } from 'expo-video';

const littleLoomLogo = require('../../../assets/logo.png');

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const POSTS_PER_PAGE = 12;

// ============================================================
// FEATURE 1: AI Content Moderation & Blur Detection
// ============================================================
class ContentModerationService {
  private static instance: ContentModerationService;
  
  static getInstance(): ContentModerationService {
    if (!ContentModerationService.instance) {
      ContentModerationService.instance = new ContentModerationService();
    }
    return ContentModerationService.instance;
  }

  // Detect sensitive content using keyword matching and pattern recognition
  detectSensitiveContent(text: string, images: string[] = []): {
    isSensitive: boolean;
    confidence: number;
    flaggedWords: string[];
    suggestedBlur: boolean;
  } {
    const sensitiveWords = [
      'violence', 'abuse', 'harassment', 'threat', 'suicide', 'self-harm',
      'bully', 'stalk', 'explicit', 'nsfw', 'gore', 'blood', 'weapon',
      'drug', 'alcohol', 'smoke', 'vape', 'hate', 'racist', 'discriminate'
    ];
    
    const flaggedWords: string[] = [];
    const lowerText = text.toLowerCase();
    
    sensitiveWords.forEach(word => {
      if (lowerText.includes(word)) {
        flaggedWords.push(word);
      }
    });

    // Image URL pattern detection for potentially sensitive content
    const suspiciousImagePatterns = [
      /\.(png|jpg|jpeg|webp)\?.*sensitive/i,
      /nsfw/i,
      /explicit/i,
      /18\+/i,
    ];

    let imageSuspicion = 0;
    images.forEach(url => {
      suspiciousImagePatterns.forEach(pattern => {
        if (pattern.test(url)) {
          imageSuspicion += 0.3;
        }
      });
    });

    const textScore = flaggedWords.length / sensitiveWords.length;
    const totalConfidence = Math.min(textScore + imageSuspicion, 1);
    const isSensitive = totalConfidence > 0.3 || flaggedWords.length > 2;
    const suggestedBlur = totalConfidence > 0.2;

    return {
      isSensitive,
      confidence: totalConfidence,
      flaggedWords,
      suggestedBlur,
    };
  }

  // Get moderation recommendations
  getModerationAction(detection: ReturnType<typeof this.detectSensitiveContent>): {
    action: 'blur' | 'warn' | 'block' | 'allow';
    message: string;
  } {
    if (detection.isSensitive && detection.confidence > 0.7) {
      return {
        action: 'block',
        message: 'This content has been automatically blocked for community safety.',
      };
    }
    if (detection.isSensitive && detection.confidence > 0.4) {
      return {
        action: 'blur',
        message: 'This content contains potentially sensitive material. Tap to view.',
      };
    }
    if (detection.flaggedWords.length > 0) {
      return {
        action: 'warn',
        message: 'This post contains flagged words. Please review before publishing.',
      };
    }
    return {
      action: 'allow',
      message: 'Content appears safe.',
    };
  }
}

// ============================================================
// FEATURE 2: Smart Topic Recommendations
// ============================================================
class TopicRecommendationEngine {
  private userInterests: Set<string> = new Set();
  private topicScores: Map<string, number> = new Map();

  updateUserInterests(topics: string[], posts: Post[]) {
    topics.forEach(t => this.userInterests.add(t));
    
    // Analyze user's post interactions
    posts.forEach(post => {
      if (post.likedBy?.length > 0) {
        const currentScore = this.topicScores.get(post.topicId) || 0;
        this.topicScores.set(post.topicId, currentScore + post.likedBy.length * 0.5);
      }
      if (post.commentsCount > 10) {
        const currentScore = this.topicScores.get(post.topicId) || 0;
        this.topicScores.set(post.topicId, currentScore + post.commentsCount * 0.3);
      }
    });
  }

  getRecommendations(topics: any[], limit: number = 3): any[] {
    const scoredTopics = topics.map(topic => ({
      ...topic,
      score: (this.topicScores.get(topic.id) || 0) + 
             (topic.trending ? 10 : 0) +
             (this.userInterests.has(topic.id) ? 5 : 0)
    }));

    return scoredTopics
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

// ============================================================
// FEATURE 3: Sentiment Analysis
// ============================================================
class SentimentAnalyzer {
  private positiveWords = new Set([
    'happy', 'joy', 'love', 'great', 'wonderful', 'amazing', 'excellent',
    'good', 'beautiful', 'fantastic', 'awesome', 'incredible', 'perfect',
    'glad', 'thankful', 'grateful', 'blessed', 'proud', 'exciting',
    'milestone', 'achievement', 'success', 'celebrate', 'celebrating'
  ]);

  private negativeWords = new Set([
    'sad', 'upset', 'angry', 'frustrated', 'worried', 'scared', 'tired',
    'exhausted', 'overwhelmed', 'stressed', 'anxious', 'depressed',
    'struggle', 'difficult', 'hard', 'tough', 'challenging', 'pain',
    'cry', 'crying', 'hurt', 'tired', 'sleep deprived'
  ]);

  analyze(text: string): {
    sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
    score: number;
    confidence: number;
    emotions: string[];
  } {
    const words = text.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;
    const detectedEmotions: string[] = [];

    words.forEach(word => {
      if (this.positiveWords.has(word)) {
        positiveCount++;
        if (!detectedEmotions.includes('joy')) detectedEmotions.push('joy');
      }
      if (this.negativeWords.has(word)) {
        negativeCount++;
        if (!detectedEmotions.includes('concern')) detectedEmotions.push('concern');
      }
    });

    // Additional emotion detection
    if (text.includes('?')) detectedEmotions.push('curious');
    if (text.includes('!')) detectedEmotions.push('excited');
    if (text.match(/[😊😁😂🤗🥰😍]/)) detectedEmotions.push('happy');
    if (text.match(/[😢😭😞😔😤]/)) detectedEmotions.push('sad');
    if (text.match(/[🤔🧐😕]/)) detectedEmotions.push('confused');

    const totalWords = words.length;
    const positiveRatio = positiveCount / totalWords;
    const negativeRatio = negativeCount / totalWords;
    const score = positiveRatio - negativeRatio;

    let sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
    let confidence = Math.abs(score);

    if (score > 0.2 && positiveCount > negativeCount) {
      sentiment = 'positive';
    } else if (score < -0.2 && negativeCount > positiveCount) {
      sentiment = 'negative';
    } else if (positiveCount > 0 && negativeCount > 0) {
      sentiment = 'mixed';
    } else {
      sentiment = 'neutral';
    }

    return {
      sentiment,
      score,
      confidence: Math.min(confidence + 0.3, 1),
      emotions: detectedEmotions.slice(0, 3),
    };
  }

  getSentimentEmoji(sentiment: string): string {
    const map: Record<string, string> = {
      positive: '😊',
      negative: '😢',
      neutral: '😐',
      mixed: '🤔',
    };
    return map[sentiment] || '😐';
  }
}

// ============================================================
// FEATURE 4: Intelligent Thread Summarization
// ============================================================
class ThreadSummarizer {
  summarize(post: Post, maxLength: number = 100): string {
    if (!post || !post.content) return '';
    
    const content = post.content;
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
    
    // Extract key sentences based on importance
    const keySentences = this.extractKeySentences(sentences, post);
    
    let summary = keySentences.join(' ');
    if (summary.length > maxLength) {
      summary = summary.slice(0, maxLength) + '...';
    }
    
    return summary;
  }

  private extractKeySentences(sentences: string[], post: Post): string[] {
    const scoredSentences = sentences.map((sentence, index) => {
      let score = 0;
      
      // Score based on position (first and last sentences often important)
      if (index === 0) score += 1.5;
      if (index === sentences.length - 1) score += 1;
      
      // Score based on length (longer sentences often more informative)
      score += Math.min(sentence.length / 50, 2);
      
      // Score based on question marks (questions often indicate main topic)
      if (sentence.includes('?')) score += 1;
      
      // Score based on keywords
      const keywords = ['important', 'key', 'main', 'need', 'help', 'advice', 'tip', 'share'];
      keywords.forEach(keyword => {
        if (sentence.toLowerCase().includes(keyword)) score += 0.5;
      });

      return { sentence, score };
    });

    // Sort by score and take top sentences
    const sorted = scoredSentences.sort((a, b) => b.score - a.score);
    const topSentences = sorted.slice(0, Math.min(3, sorted.length));
    
    // Return in original order for coherence
    return sentences.filter(s => 
      topSentences.some(ts => ts.sentence === s)
    );
  }

  generateTLDR(post: Post): string {
    const summary = this.summarize(post, 60);
    return `📝 TL;DR: ${summary}`;
  }
}

// ============================================================
// FEATURE 5: Predictive Engagement Scoring
// ============================================================
class EngagementPredictor {
  predictEngagement(post: Post, historicalData: Post[]): {
    predictedLikes: number;
    predictedComments: number;
    predictedShares: number;
    willTrend: boolean;
    confidence: number;
  } {
    if (!post || !historicalData.length) {
      return {
        predictedLikes: 0,
        predictedComments: 0,
        predictedShares: 0,
        willTrend: false,
        confidence: 0,
      };
    }

    // Factors that predict high engagement
    const hasImage = post.images && post.images.length > 0;
    const contentLength = post.content.length;
    const hasPoll = !!post.poll;
    const hasMood = !!post.mood;
    const topicPopularity = this.getTopicPopularity(post.topicId, historicalData);
    const authorInfluence = this.getAuthorInfluence(post.authorId, historicalData);

    // Calculate weighted score
    let score = 0;
    score += hasImage ? 15 : 0;
    score += hasPoll ? 20 : 0;
    score += hasMood ? 10 : 0;
    score += Math.min(contentLength / 50, 10); // Longer content often more engaging
    score += topicPopularity * 2;
    score += authorInfluence * 1.5;

    // Normalize to predictions
    const baseLikes = historicalData.reduce((sum, p) => sum + p.likes, 0) / historicalData.length;
    const baseComments = historicalData.reduce((sum, p) => sum + p.commentsCount, 0) / historicalData.length;
    const baseShares = historicalData.reduce((sum, p) => sum + p.reposts, 0) / historicalData.length;

    const multiplier = 1 + (score / 100);
    const predictedLikes = Math.round(baseLikes * multiplier);
    const predictedComments = Math.round(baseComments * multiplier);
    const predictedShares = Math.round(baseShares * multiplier);
    const willTrend = score > 60;
    const confidence = Math.min(score / 80, 0.95);

    return {
      predictedLikes,
      predictedComments,
      predictedShares,
      willTrend,
      confidence,
    };
  }

  private getTopicPopularity(topicId: string, historicalData: Post[]): number {
    const topicPosts = historicalData.filter(p => p.topicId === topicId);
    if (!topicPosts.length) return 0;
    const avgEngagement = topicPosts.reduce((sum, p) => sum + p.likes + p.commentsCount * 2, 0) / topicPosts.length;
    return Math.min(avgEngagement / 50, 10);
  }

  private getAuthorInfluence(authorId: string, historicalData: Post[]): number {
    const authorPosts = historicalData.filter(p => p.authorId === authorId);
    if (!authorPosts.length) return 1;
    const avgEngagement = authorPosts.reduce((sum, p) => sum + p.likes + p.reposts, 0) / authorPosts.length;
    return Math.max(1, Math.min(avgEngagement / 20, 5));
  }
}

// ============================================================
// FEATURE 6: Smart Reply Suggestions
// ============================================================
class ReplySuggestionEngine {
  private commonPhrases = [
    "That's so helpful, thank you! 🙏",
    "I completely understand how you feel. 💙",
    "This is exactly what I needed to hear today!",
    "Thank you for sharing this journey with us.",
    "You're doing amazing, keep going! 🌟",
    "I'm so proud of you both! 🎉",
    "This made my day, thank you! ✨",
    "Sending you love and support. 💖",
  ];

  private topicSpecificReplies: Record<string, string[]> = {
    'Potty Training': [
      "We're going through this too! 💪",
      "This tip worked wonders for us! 🚽",
      "Patience is key, you've got this!",
    ],
    'Sleep Tips': [
      "Sleep deprivation is real, hang in there! 😴",
      "This routine saved our nights! 🌙",
      "We're in the same boat, stay strong!",
    ],
    'Feeding & Nutrition': [
      "Our little one loved this! 🍼",
      "Such great advice, thank you!",
      "We struggled too, it gets better!",
    ],
    'Milestones': [
      "What a beautiful moment! 🏆",
      "Celebrating with you! 🎉",
      "This brought tears to my eyes! 😢",
    ],
  };

  getSuggestions(post: Post, context: string = ''): string[] {
    const suggestions: string[] = [];
    
    // Add topic-specific suggestions
    const topicReplies = this.topicSpecificReplies[post.topic] || [];
    suggestions.push(...topicReplies.slice(0, 2));

    // Add mood-based suggestions
    if (post.mood === 'celebrating') {
      suggestions.push("🎉 Congratulations, this is wonderful!");
      suggestions.push("So happy for you! 🥳");
    } else if (post.mood === 'venting') {
      suggestions.push("💙 I hear you, that sounds really tough.");
      suggestions.push("You're not alone in this. 🙏");
    } else if (post.mood === 'support') {
      suggestions.push("💙 Sending you so much love right now.");
      suggestions.push("We're all here for you. 🌈");
    } else if (post.mood === 'advice') {
      suggestions.push("💡 That's such great advice, thank you!");
      suggestions.push("I needed to hear this today. 🙌");
    }

    // Add general supportive phrases
    suggestions.push(...this.commonPhrases.slice(0, 3));

    // Deduplicate and limit
    const uniqueSuggestions = Array.from(new Set(suggestions));
    return uniqueSuggestions.slice(0, 6);
  }

  getAISuggestions(postContent: string): string[] {
    // Simple AI-like suggestions based on content analysis
    const suggestions: string[] = [];
    
    if (postContent.includes('?')) {
      suggestions.push("Great question! I was wondering the same thing. 🤔");
      suggestions.push("Here's what worked for us... 💡");
    }
    
    if (postContent.includes('help') || postContent.includes('advice')) {
      suggestions.push("I'd be happy to share my experience! 💙");
      suggestions.push("Let me offer some perspective... 🌟");
    }
    
    if (postContent.match(/[😊😁😂🤗🥰😍]/)) {
      suggestions.push("Your positivity is infectious! ✨");
      suggestions.push("This brought a smile to my face! 😊");
    }
    
    return suggestions;
  }
}

// ============================================================
// DS CONSTANTS (unchanged)
// ============================================================
const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  primaryGhost: 'rgba(99,102,241,0.08)',
  accent: '#ec4899',
  accentLight: '#f472b6',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0ea5e9',
  danger: '#ef4444',
  
  mood: {
    celebrating: { bg: '#fef3c7', text: '#d97706', icon: 'happy-outline', glow: '#fbbf24' },
    support: { bg: '#fce7f3', text: '#db2777', icon: 'heart-circle-outline', glow: '#f472b6' },
    advice: { bg: '#e0e7ff', text: '#4f46e5', icon: 'bulb-outline', glow: '#818cf8' },
    milestone: { bg: '#d1fae5', text: '#059669', icon: 'trophy-outline', glow: '#34d399' },
    venting: { bg: '#fee2e2', text: '#dc2626', icon: 'thunderstorm-outline', glow: '#f87171' },
  },
  
  white: '#ffffff',
  gray50: '#fafaf9',
  gray100: '#f5f5f4',
  gray200: '#e7e5e4',
  gray300: '#d6d3d1',
  gray400: '#a8a29e',
  gray500: '#78716c',
  gray600: '#57534e',
  gray700: '#44403c',
  gray800: '#292524',
  gray900: '#1c1917',
  
  darkBg: '#0c0a09',
  darkSurface: '#1c1917',
  darkCard: '#292524',
  darkElevated: '#44403c',
  darkBorder: 'rgba(255,255,255,0.06)',
  
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40, '5xl': 56 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  
  text: {
    xs: { size: 11, line: 14, weight: '500' as const },
    sm: { size: 13, line: 18, weight: '500' as const },
    base: { size: 15, line: 22, weight: '400' as const },
    lg: { size: 17, line: 24, weight: '600' as const },
    xl: { size: 20, line: 28, weight: '700' as const },
    '2xl': { size: 26, line: 34, weight: '800' as const },
  },
  
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 40, elevation: 12 },
    glow: { shadowColor: '#6366f1', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  },
};

const ROUTES = {
  CREATE_POST: 'CreatePost',
  POST_DETAIL: 'PostDetail',
  USER_PROFILE: 'CommunityMemberProfile',
  EDIT_PROFILE: 'CommunityProfile',
  NOTIFICATIONS: 'Notifications',
  MESSAGES: 'ChatList',
  TOPICS: 'Topic',
  REPORT: 'Report',
  FOLLOWERS: 'Followers',
  FOLLOWING: 'Following',
  SEARCH_USERS: 'SearchUsers',
} as const;

type Props = NativeStackScreenProps<CommunityStackParamList, 'CommunityMain'>;

const STATUS_BAR_HEIGHT = StatusBar.currentHeight || 0;
const HEADER_TOP_PADDING = Platform.OS === 'ios' ? 52 : STATUS_BAR_HEIGHT + 14;
const HEADER_TOTAL_HEIGHT = HEADER_TOP_PADDING + 52;

// ============================================================
// BLURRED IMAGE COMPONENT (with AI blur detection)
// ============================================================
const BlurredImage = React.memo(({ 
  imageUri, 
  isSensitive, 
  onTap, 
  isDark,
  moderationAction,
}: { 
  imageUri: string; 
  isSensitive: boolean; 
  onTap: () => void;
  isDark: boolean;
  moderationAction: 'blur' | 'warn' | 'block' | 'allow';
}) => {
  const [showContent, setShowContent] = useState(false);
  const blurIntensity = useSharedValue(20);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const handlePress = () => {
    if (moderationAction === 'block') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    
    if (moderationAction === 'blur' || isSensitive) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShowContent(!showContent);
      
      if (!showContent) {
        blurIntensity.value = withTiming(0, { duration: 300 });
        scale.value = withSequence(
          withTiming(1.02, { duration: 150 }),
          withTiming(1, { duration: 150 })
        );
      } else {
        blurIntensity.value = withTiming(20, { duration: 300 });
      }
    }
    onTap();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (moderationAction === 'block') {
    return (
      <View style={[styles.blockedImageContainer, { backgroundColor: isDark ? DS.darkCard : DS.gray100 }]}>
        <LinearGradient
          colors={[DS.danger, DS.accent]}
          style={styles.blockedGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="shield-outline" size={32} color={DS.white} />
          <Text style={styles.blockedImageText}>Content Blocked</Text>
          <Text style={styles.blockedImageSubtext}>For community safety</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[styles.blurredImageWrap, animatedStyle]}>
        <Image 
          source={{ uri: imageUri }} 
          style={styles.blurredImage} 
          resizeMode="cover"
          blurRadius={showContent ? 0 : 20}
        />
        {(isSensitive && !showContent) && (
          <BlurView
            intensity={80}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          >
            <View style={styles.blurOverlay}>
              <View style={[styles.blurIconWrap, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)' }]}>
                <Ionicons name="eye-off" size={24} color={isDark ? DS.white : DS.gray700} />
              </View>
              <Text style={[styles.blurText, { color: isDark ? DS.white : DS.gray700 }]}>
                {moderationAction === 'warn' ? '⚠️ Potentially sensitive' : '🔞 Sensitive content'}
              </Text>
              <Text style={[styles.blurSubtext, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                Tap to view
              </Text>
            </View>
          </BlurView>
        )}
        {showContent && isSensitive && (
          <View style={styles.showingContentBadge}>
            <Text style={styles.showingContentText}>Content visible</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
});

// ============================================================
// INTELLIGENT THREAD SUMMARIZATION BADGE
// ============================================================
const ThreadSummaryBadge = React.memo(({ post, isDark }: { post: Post; isDark: boolean }) => {
  const [showSummary, setShowSummary] = useState(false);
  const summarizer = useMemo(() => new ThreadSummarizer(), []);
  const summary = useMemo(() => summarizer.summarize(post, 80), [post, summarizer]);
  const tldr = useMemo(() => summarizer.generateTLDR(post), [post, summarizer]);

  if (post.content.length < 100) return null;

  return (
    <View style={[styles.summaryWrap, { backgroundColor: isDark ? 'rgba(99,102,241,0.08)' : DS.primaryGhost }]}>
      <TouchableOpacity
        onPress={() => setShowSummary(!showSummary)}
        style={styles.summaryToggle}
      >
        <Ionicons name="sparkles" size={14} color={DS.primary} />
        <Text style={[styles.summaryToggleText, { color: DS.primary }]}>
          {showSummary ? 'Hide summary' : 'AI Summary'}
        </Text>
        <Ionicons 
          name={showSummary ? 'chevron-up' : 'chevron-down'} 
          size={14} 
          color={DS.primary} 
        />
      </TouchableOpacity>
      
      {showSummary && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.summaryContent}>
          <Text style={[styles.summaryText, { color: isDark ? DS.gray300 : DS.gray700 }]}>
            {tldr}
          </Text>
          <Text style={[styles.summaryFull, { color: isDark ? DS.gray400 : DS.gray500 }]}>
            {summary}
          </Text>
        </Animated.View>
      )}
    </View>
  );
});

// ============================================================
// SENTIMENT INDICATOR
// ============================================================
const SentimentIndicator = React.memo(({ post, isDark }: { post: Post; isDark: boolean }) => {
  const analyzer = useMemo(() => new SentimentAnalyzer(), []);
  const analysis = useMemo(() => analyzer.analyze(post.content), [post.content, analyzer]);
  const emoji = analyzer.getSentimentEmoji(analysis.sentiment);

  const getColor = () => {
    switch (analysis.sentiment) {
      case 'positive': return DS.success;
      case 'negative': return DS.danger;
      case 'mixed': return DS.warning;
      default: return DS.gray400;
    }
  };

  const getLabel = () => {
    switch (analysis.sentiment) {
      case 'positive': return 'Positive vibe';
      case 'negative': return 'Needs support';
      case 'mixed': return 'Mixed feelings';
      default: return 'Neutral';
    }
  };

  if (analysis.confidence < 0.3) return null;

  return (
    <View style={[styles.sentimentWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.gray50 }]}>
      <Text style={styles.sentimentEmoji}>{emoji}</Text>
      <View style={styles.sentimentBar}>
        <View 
          style={[
            styles.sentimentFill, 
            { 
              width: `${(analysis.score + 1) / 2 * 100}%`,
              backgroundColor: getColor(),
            }
          ]} 
        />
      </View>
      <Text style={[styles.sentimentLabel, { color: getColor() }]}>
        {getLabel()}
      </Text>
      {analysis.emotions.length > 0 && (
        <View style={styles.emotionTags}>
          {analysis.emotions.map((emotion, i) => (
            <View key={i} style={[styles.emotionTag, { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : DS.primaryGhost }]}>
              <Text style={[styles.emotionTagText, { color: DS.primary }]}>{emotion}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
});

// ============================================================
// ENGAGEMENT PREDICTION BADGE
// ============================================================
const EngagementPredictionBadge = React.memo(({ post, isDark }: { post: Post; isDark: boolean }) => {
  const predictor = useMemo(() => new EngagementPredictor(), []);
  const [prediction, setPrediction] = useState<ReturnType<typeof predictor.predictEngagement> | null>(null);

  useEffect(() => {
    const historicalData = [post]; // In real app, this would be all posts
    const result = predictor.predictEngagement(post, historicalData);
    setPrediction(result);
  }, [post]);

  if (!prediction || prediction.confidence < 0.3) return null;

  return (
    <View style={[styles.predictionWrap, { backgroundColor: isDark ? 'rgba(99,102,241,0.06)' : DS.primaryGhost }]}>
      <View style={styles.predictionHeader}>
        <Ionicons name="analytics-outline" size={14} color={DS.primary} />
        <Text style={[styles.predictionTitle, { color: isDark ? DS.gray300 : DS.gray700 }]}>
          Engagement Forecast
        </Text>
        {prediction.willTrend && (
          <View style={styles.trendingPredictionBadge}>
            <Ionicons name="flame" size={10} color={DS.warning} />
            <Text style={styles.trendingPredictionText}>Trending soon!</Text>
          </View>
        )}
      </View>
      <View style={styles.predictionStats}>
        <View style={styles.predictionStat}>
          <Text style={[styles.predictionStatValue, { color: isDark ? DS.white : DS.gray800 }]}>
            {prediction.predictedLikes}
          </Text>
          <Text style={[styles.predictionStatLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>
            ❤️ Likes
          </Text>
        </View>
        <View style={[styles.predictionDivider, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
        <View style={styles.predictionStat}>
          <Text style={[styles.predictionStatValue, { color: isDark ? DS.white : DS.gray800 }]}>
            {prediction.predictedComments}
          </Text>
          <Text style={[styles.predictionStatLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>
            💬 Comments
          </Text>
        </View>
        <View style={[styles.predictionDivider, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
        <View style={styles.predictionStat}>
          <Text style={[styles.predictionStatValue, { color: isDark ? DS.white : DS.gray800 }]}>
            {prediction.predictedShares}
          </Text>
          <Text style={[styles.predictionStatLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>
            🔄 Shares
          </Text>
        </View>
      </View>
      <View style={styles.predictionConfidence}>
        <View style={[styles.confidenceBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray200 }]}>
          <View 
            style={[
              styles.confidenceFill, 
              { 
                width: `${prediction.confidence * 100}%`,
                backgroundColor: prediction.confidence > 0.7 ? DS.success : DS.warning,
              }
            ]} 
          />
        </View>
        <Text style={[styles.confidenceText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
          {Math.round(prediction.confidence * 100)}% confidence
        </Text>
      </View>
    </View>
  );
});

// ============================================================
// SMART REPLY SUGGESTIONS
// ============================================================
const SmartReplySuggestions = React.memo(({ 
  post, 
  onSelect, 
  isDark,
  show,
}: { 
  post: Post; 
  onSelect: (reply: string) => void; 
  isDark: boolean;
  show: boolean;
}) => {
  const engine = useMemo(() => new ReplySuggestionEngine(), []);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (show) {
      const baseSuggestions = engine.getSuggestions(post);
      const aiSuggestions = engine.getAISuggestions(post.content);
      const allSuggestions = [...baseSuggestions, ...aiSuggestions];
      setSuggestions(Array.from(new Set(allSuggestions)).slice(0, 6));
    }
  }, [show, post, engine]);

  if (!show || !suggestions.length) return null;

  return (
    <Animated.View 
      entering={FadeInDown.duration(300).springify()}
      style={[styles.smartReplyWrap, { backgroundColor: isDark ? DS.darkCard : DS.white }]}
    >
      <View style={styles.smartReplyHeader}>
        <Ionicons name="chatbubble-ellipses" size={14} color={DS.primary} />
        <Text style={[styles.smartReplyTitle, { color: isDark ? DS.white : DS.gray800 }]}>
          Smart Replies
        </Text>
        <Text style={[styles.smartReplySubtitle, { color: isDark ? DS.gray400 : DS.gray500 }]}>
          AI-powered suggestions
        </Text>
      </View>
      <View style={styles.smartReplyChips}>
        {suggestions.map((suggestion, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.smartReplyChip, { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : DS.primaryGhost }]}
            onPress={() => onSelect(suggestion)}
          >
            <Text style={[styles.smartReplyChipText, { color: DS.primary }]}>
              {suggestion}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
});

// ============================================================
// SMART TOPIC RECOMMENDATIONS
// ============================================================
const SmartTopicRecommendations = React.memo(({ 
  posts, 
  topics, 
  onSelect, 
  isDark 
}: { 
  posts: Post[]; 
  topics: any[]; 
  onSelect: (topicId: string) => void; 
  isDark: boolean;
}) => {
  const engine = useMemo(() => new TopicRecommendationEngine(), []);
  const [recommendations, setRecommendations] = useState<any[]>([]);

  useEffect(() => {
    // Update user interests from posts they've interacted with
    const userPostIds = posts.map(p => p.authorId);
    const userTopics = posts.filter(p => userPostIds.includes(p.authorId)).map(p => p.topicId);
    engine.updateUserInterests(userTopics, posts);
    
    const recs = engine.getRecommendations(topics, 4);
    setRecommendations(recs);
  }, [posts, topics, engine]);

  if (!recommendations.length) return null;

  return (
    <View style={[styles.topicRecWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.gray50 }]}>
      <View style={styles.topicRecHeader}>
        <Ionicons name="compass-outline" size={14} color={DS.primary} />
        <Text style={[styles.topicRecTitle, { color: isDark ? DS.white : DS.gray800 }]}>
          Recommended Topics
        </Text>
        <Text style={[styles.topicRecSubtitle, { color: isDark ? DS.gray400 : DS.gray500 }]}>
          Based on your interests
        </Text>
      </View>
      <View style={styles.topicRecList}>
        {recommendations.map((topic) => (
          <TouchableOpacity
            key={topic.id}
            style={[styles.topicRecItem, { backgroundColor: isDark ? DS.darkCard : DS.white }]}
            onPress={() => onSelect(topic.id)}
          >
            <View style={[styles.topicRecIcon, { backgroundColor: `${topic.color}20` }]}>
              <Text style={styles.topicRecEmoji}>{topic.emoji}</Text>
            </View>
            <View style={styles.topicRecInfo}>
              <Text style={[styles.topicRecName, { color: isDark ? DS.white : DS.gray800 }]}>
                {topic.name}
              </Text>
              <Text style={[styles.topicRecDesc, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                {topic.members} members · {topic.posts} posts
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={DS.gray400} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

// ============================================================
// MODERATION BADGE
// ============================================================
const ModerationBadge = React.memo(({ 
  post, 
  isDark 
}: { 
  post: Post; 
  isDark: boolean;
}) => {
  const moderationService = useMemo(() => ContentModerationService.getInstance(), []);
  const detection = useMemo(() => 
    moderationService.detectSensitiveContent(post.content, post.images || []),
    [post.content, post.images, moderationService]
  );

  if (!detection.isSensitive && !detection.flaggedWords.length) return null;

  return (
    <View style={[styles.moderationWrap, { backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : '#fef2f2' }]}>
      <Ionicons name="shield-checkmark" size={14} color={DS.danger} />
      <Text style={[styles.moderationText, { color: DS.danger }]}>
        {detection.isSensitive ? '⚠️ Auto-blurred for safety' : `🚩 Flagged: ${detection.flaggedWords.join(', ')}`}
      </Text>
    </View>
  );
});

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function CommunityScreen({ navigation }: Props) {
  const sweetAlert = useSweetAlert();
  useRouteBasedNavVisibility();

  const community = useCommunity();
  const {
    posts,
    topics,
    currentUser,
    likePost,
    unlikePost,
    repostPost,
    unrepostPost,
    bookmarkPost,
    deletePost,
    addComment,
    likeComment,
    replyToComment,
    voteHelpful,
    followUser,
    unfollowUser,
    isFollowing,
    refreshFeed,
    loadMorePosts,
    getFeedPosts,
    getUnreadCount,
    incrementViewCount,
    isAuthenticated: checkIsAuth,
    getAllUsers,
    votePoll,
    markAllNotificationsRead,
    getUserById: contextGetUserById,
    sharePost,
  } = community;

  const { isAuthenticated: authIsAuth } = useAuth();
  const { triggerHaptic } = useCustomization();
  const { settings } = useCustomization();
  const isDark = settings?.darkMode ?? false;

  // Feature services
  const moderationService = useMemo(() => ContentModerationService.getInstance(), []);
  const sentimentAnalyzer = useMemo(() => new SentimentAnalyzer(), []);
  const summarizer = useMemo(() => new ThreadSummarizer(), []);
  const predictor = useMemo(() => new EngagementPredictor(), []);
  const replyEngine = useMemo(() => new ReplySuggestionEngine(), []);
  const topicEngine = useMemo(() => new TopicRecommendationEngine(), []);

  const [refreshing, setRefreshing] = useState(false);
  const [activeTopic, setActiveTopic] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<{ postId: string; commentId: string } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [visiblePostIds, setVisiblePostIds] = useState<Set<string>>(new Set());
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [showBanner, setShowBanner] = useState(false);
  const [displayedPosts, setDisplayedPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [showNotificationChooser, setShowNotificationChooser] = useState(false);
  const [showSmartRepliesFor, setShowSmartRepliesFor] = useState<string | null>(null);

  const scrollY = useSharedValue(0);
  const listRef = useRef<FlatList>(null);
  const prevPostsRef = useRef<Post[]>([]);

  const unreadCount = getUnreadCount();
  const canInteract = useMemo(() => checkIsAuth() || authIsAuth, [checkIsAuth, authIsAuth]);
  const allUsers = useMemo(() => getAllUsers(), [getAllUsers, posts.length]);

  const postsCount = posts.length;
  const membersCount = allUsers.length;

  const composeSuggestions = useMemo(() => {
    const userTopics = currentUser?.selectedTopics || [];
    const userTopicNames = userTopics.map(id => {
      const topic = topics.find(t => t.id === id);
      return topic?.name || '';
    }).filter(Boolean);
    
    const suggestions: string[] = [];
    if (userTopicNames.some(t => t.includes('Potty'))) {
      suggestions.push("Potty training tip that worked for us 🚽");
    }
    if (userTopicNames.some(t => t.includes('Sleep'))) {
      suggestions.push("Sleep regression survival guide 😴");
    }
    if (userTopicNames.some(t => t.includes('Feeding'))) {
      suggestions.push("Baby-led weaning experience 🍼");
    }
    if (userTopicNames.some(t => t.includes('Education'))) {
      suggestions.push("Early learning activity we love 📚");
    }
    if (userTopicNames.some(t => t.includes('Health'))) {
      suggestions.push("Natural remedies that actually work 💊");
    }
    suggestions.push("Share a milestone your little one reached 🎉");
    suggestions.push("What's your favorite parenting hack? 💡");
    suggestions.push("Need support? We're here 💙");
    
    return suggestions.slice(0, 6);
  }, [topics, currentUser]);

  const getUserById = useCallback((userId: string) => {
    if (contextGetUserById) return contextGetUserById(userId);
    if (userId === currentUser?.id) return currentUser;
    return allUsers.find(u => u.id === userId);
  }, [contextGetUserById, currentUser, allUsers]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const filtered = getFilteredPosts();
    setDisplayedPosts(filtered.slice(0, POSTS_PER_PAGE));
    setHasMore(filtered.length > POSTS_PER_PAGE);
    setPage(1);
  }, [posts, activeTopic, searchQuery]);

  useEffect(() => {
    if (prevPostsRef.current.length > 0 && posts.length > prevPostsRef.current.length) {
      const count = posts.length - prevPostsRef.current.length;
      setNewPostsCount(count);
      setShowBanner(true);
    }
    prevPostsRef.current = posts;
  }, [posts]);

  useEffect(() => {
    if (showBanner && newPostsCount > 0) {
      const timer = setTimeout(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
        setShowBanner(false);
        setNewPostsCount(0);
      }, 1600);
      return () => clearTimeout(timer);
    }
  }, [showBanner, newPostsCount]);

  const getFilteredPosts = useCallback(() => {
    let filtered = getFeedPosts();
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    const welcomePost = filtered.find(p => p.authorId === 'littleloom_team');
    if (welcomePost) {
      filtered = filtered.filter(p => p.id !== welcomePost.id);
      filtered.unshift(welcomePost);
    }
    if (activeTopic !== 'all') filtered = filtered.filter(p => p.topicId === activeTopic);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.content.toLowerCase().includes(q) ||
        p.author.displayName.toLowerCase().includes(q) ||
        p.topic.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [activeTopic, searchQuery, getFeedPosts, posts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    triggerHaptic('light');
    await refreshFeed();
    setRefreshing(false);
    setPage(1);
    const filtered = getFilteredPosts();
    setDisplayedPosts(filtered.slice(0, POSTS_PER_PAGE));
    setHasMore(filtered.length > POSTS_PER_PAGE);
  }, [refreshFeed, triggerHaptic, getFilteredPosts]);

  const onLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await loadMorePosts();
    const nextPage = page + 1;
    const filtered = getFilteredPosts();
    const start = page * POSTS_PER_PAGE;
    const end = start + POSTS_PER_PAGE;
    const newPosts = filtered.slice(start, end);
    if (newPosts.length > 0) {
      setDisplayedPosts(prev => [...prev, ...newPosts]);
      setPage(nextPage);
      setHasMore(filtered.length > end);
    } else {
      setHasMore(false);
    }
    setLoadingMore(false);
  }, [loadMorePosts, loadingMore, hasMore, page, getFilteredPosts]);

  const handleLike = useCallback(async (postId: string) => {
    if (!canInteract) {
      sweetAlert.alert('Sign In Required', 'Please sign in to like threads', 'warning');
      return;
    }
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    triggerHaptic('light');
    post.isLiked ? await unlikePost(postId) : await likePost(postId);
  }, [canInteract, posts, triggerHaptic, unlikePost, likePost, sweetAlert]);

  const handleRepost = useCallback(async (postId: string) => {
    if (!canInteract) {
      sweetAlert.alert('Sign In Required', 'Please sign in to reweave', 'warning');
      return;
    }
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    triggerHaptic('medium');
    post.isReposted ? await unrepostPost(postId) : await repostPost(postId);
  }, [canInteract, posts, triggerHaptic, unrepostPost, repostPost, sweetAlert]);

  const handleBookmark = useCallback(async (postId: string) => {
    if (!canInteract) {
      sweetAlert.alert('Sign In Required', 'Please sign in to bookmark', 'warning');
      return;
    }
    triggerHaptic('light');
    await bookmarkPost(postId);
  }, [canInteract, triggerHaptic, bookmarkPost, sweetAlert]);

  const handleShare = useCallback(async (post: Post) => {
    try {
      await Share.share({
        message: `${post.author.displayName} on LittleLoom: "${post.content.substring(0, 100)}..."`,
      });
      if (sharePost) await sharePost(post.id);
    } catch (e) { console.error(e); }
  }, [sharePost]);

  const handleDelete = useCallback((postId: string) => {
    sweetAlert.confirm(
      'Unravel this thread?',
      'This cannot be undone.',
      () => deletePost(postId),
      undefined,
      'Delete',
      'Cancel',
      true
    );
  }, [deletePost, sweetAlert]);

  const handleCommentSubmit = useCallback(async (postId: string) => {
    if (!canInteract) {
      sweetAlert.alert('Sign In Required', 'Please sign in to reply', 'warning');
      return;
    }
    const content = commentInputs[postId]?.trim();
    if (!content) return;
    triggerHaptic('light');
    if (replyingTo?.postId === postId) {
      await replyToComment(postId, replyingTo.commentId, content);
      setReplyingTo(null);
    } else {
      await addComment(postId, content);
    }
    setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    setShowSmartRepliesFor(null);
  }, [canInteract, commentInputs, replyingTo, triggerHaptic, replyToComment, addComment, sweetAlert]);

  const handleVotePoll = useCallback(async (postId: string, optionId: string) => {
    if (!canInteract) {
      sweetAlert.alert('Sign In Required', 'Please sign in to vote', 'warning');
      return;
    }
    await votePoll(postId, optionId);
  }, [canInteract, votePoll, sweetAlert]);

  const handleSmartReplySelect = useCallback((postId: string, reply: string) => {
    setCommentInputs(prev => ({ ...prev, [postId]: reply }));
    setShowSmartRepliesFor(null);
    // Auto-focus comment input
    setTimeout(() => {
      // Focus the comment input
    }, 300);
  }, []);

  const handleScrollToNew = useCallback(() => {
    setShowBanner(false);
    setNewPostsCount(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    onRefresh();
  }, [onRefresh]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const visibleIds = new Set(viewableItems.map(v => (v.item as Post).id));
    setVisiblePostIds(visibleIds);
    viewableItems.forEach(v => incrementViewCount((v.item as Post).id));
  }, [incrementViewCount]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 45 }).current;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
    },
  });

  // ============================================================
  // RENDER POST WITH ALL FEATURES
  // ============================================================
  const renderPost = useCallback(({ item, index }: { item: Post; index: number }) => {
    const detection = moderationService.detectSensitiveContent(item.content, item.images || []);
    const moderationAction = moderationService.getModerationAction(detection);
    const shouldBlurImages = moderationAction.action === 'blur' || detection.suggestedBlur;

    const renderImage = (uri: string, idx: number) => {
      if (moderationAction.action === 'block') {
        return (
          <View key={idx} style={styles.blockedImageContainer}>
            <LinearGradient colors={[DS.danger, DS.accent]} style={styles.blockedGradient}>
              <Ionicons name="shield-outline" size={24} color={DS.white} />
              <Text style={styles.blockedImageTextSmall}>Blocked</Text>
            </LinearGradient>
          </View>
        );
      }
      return (
        <BlurredImage
          key={idx}
          imageUri={uri}
          isSensitive={shouldBlurImages}
          isDark={isDark}
          moderationAction={moderationAction.action}
          onTap={() => {}}
        />
      );
    };

    return (
      <Animated.View
        entering={FadeInUp.delay(index < 6 ? index * 80 : 0).duration(500).springify()}
        layout={Layout.springify()}
      >
        <View style={[styles.postCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          {/* Post Header */}
          <View style={styles.postHeader}>
            <TouchableOpacity
              style={styles.authorRow}
              onPress={() => navigation.navigate(
                item.authorId === currentUser?.id ? ROUTES.EDIT_PROFILE : ROUTES.USER_PROFILE,
                { userId: item.authorId }
              )}
            >
              <SafeAvatar
                avatar={item.author.avatar}
                size={44}
                fallbackIcon="person"
                fallbackColor={DS.primary}
                fallbackBgColor={`${DS.primary}15`}
              />
              <View style={styles.authorInfo}>
                <Text style={[styles.authorName, { color: isDark ? DS.white : DS.gray900 }]}>
                  {item.isAnonymous ? 'Anonymous Parent' : item.author.displayName}
                </Text>
                <Text style={[styles.handleText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                  {item.isAnonymous ? '@anonymous' : (item.author?.handle || '')}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity>
              <Ionicons name="ellipsis-horizontal" size={20} color={isDark ? DS.gray400 : DS.gray500} />
            </TouchableOpacity>
          </View>

          {/* Sentiment Indicator */}
          <SentimentIndicator post={item} isDark={isDark} />

          {/* Moderation Badge */}
          <ModerationBadge post={item} isDark={isDark} />

          {/* Content */}
          <TouchableOpacity onPress={() => navigation.navigate(ROUTES.POST_DETAIL, { postId: item.id })}>
            <Text style={[styles.postText, { color: isDark ? DS.gray300 : DS.gray700 }]}>
              {item.content}
            </Text>
          </TouchableOpacity>

          {/* Thread Summary */}
          <ThreadSummaryBadge post={item} isDark={isDark} />

          {/* Images with blur */}
          {item.images && item.images.length > 0 && (
            <View style={styles.mediaBox}>
              {item.images.length === 1 ? (
                renderImage(item.images[0], 0)
              ) : (
                <View style={styles.imageGrid}>
                  {item.images.slice(0, 4).map((uri, idx) => renderImage(uri, idx))}
                </View>
              )}
            </View>
          )}

          {/* Poll */}
          {item.poll && (
            <View style={{ paddingHorizontal: DS.space.lg, marginBottom: DS.space.md }}>
              <PollWidget poll={item.poll} postId={item.id} onVote={handleVotePoll} isDark={isDark} />
            </View>
          )}

          {/* Engagement Prediction */}
          <EngagementPredictionBadge post={item} isDark={isDark} />

          {/* Topic Tag */}
          <TouchableOpacity
            onPress={() => navigation.navigate(ROUTES.TOPICS, { topicId: item.topicId })}
            style={[styles.topicTag, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray50 }]}
          >
            <View style={[styles.topicDot, { backgroundColor: topics.find(t => t.id === item.topicId)?.color || DS.primary }]} />
            <Text style={[styles.topicTagText, { color: topics.find(t => t.id === item.topicId)?.color || DS.primary }]}>
              {item.topic}
            </Text>
          </TouchableOpacity>

          {/* Engagement Bar */}
          <View style={styles.engagementBar}>
            <Text style={[styles.engagementText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {item.likes > 0 ? `${item.likes} likes` : ''}
              {item.likes > 0 && item.commentsCount > 0 ? ' · ' : ''}
              {item.commentsCount > 0 ? `${item.commentsCount} comments` : ''}
              {((item.likes > 0 || item.commentsCount > 0) && item.reposts > 0) ? ' · ' : ''}
              {item.reposts > 0 ? `${item.reposts} reposts` : ''}
            </Text>
          </View>

          {/* Reaction Bar */}
          <View style={[styles.reactionBar, { borderTopColor: isDark ? DS.darkBorder : DS.gray200 }]}>
            <Pressable onPress={() => handleLike(item.id)} style={styles.reactionBtn}>
              <Ionicons name={item.isLiked ? 'heart' : 'heart-outline'} size={22} color={item.isLiked ? DS.accent : DS.gray400} />
            </Pressable>
            <Pressable onPress={() => setExpandedPostId(expandedPostId === item.id ? null : item.id)} style={styles.reactionBtn}>
              <Ionicons name="chatbubble-outline" size={20} color={DS.gray400} />
              <Text style={styles.reactionCount}>{item.commentsCount > 0 ? item.commentsCount : 'Comment'}</Text>
            </Pressable>
            <Pressable onPress={() => handleRepost(item.id)} style={styles.reactionBtn}>
              <Ionicons name={item.isReposted ? 'repeat' : 'repeat-outline'} size={20} color={item.isReposted ? DS.success : DS.gray400} />
            </Pressable>
            <Pressable onPress={() => handleBookmark(item.id)} style={styles.reactionBtn}>
              <Ionicons name={item.isBookmarked ? 'bookmark' : 'bookmark-outline'} size={20} color={item.isBookmarked ? DS.primary : DS.gray400} />
            </Pressable>
            <Pressable onPress={() => handleShare(item)} style={styles.reactionBtn}>
              <Ionicons name="share-outline" size={20} color={DS.gray400} />
            </Pressable>
          </View>

          {/* Comments Section with Smart Replies */}
          {expandedPostId === item.id && (
            <View style={[styles.commentsBox, { borderTopColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              {item.comments.slice(0, 3).map((c) => (
                <View key={c.id} style={styles.inlineComment}>
                  <SafeAvatar avatar={c.author.avatar} size={28} fallbackIcon="person" fallbackColor={DS.primary} fallbackBgColor={`${DS.primary}15`} />
                  <View style={styles.inlineCommentContent}>
                    <View style={[styles.inlineCommentBubble, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray50 }]}>
                      <Text style={[styles.inlineCommentAuthor, { color: isDark ? DS.white : DS.gray800 }]}>{c.author.displayName}</Text>
                      <Text style={[styles.inlineCommentText, { color: isDark ? DS.gray400 : DS.gray600 }]}>{c.content}</Text>
                    </View>
                  </View>
                </View>
              ))}
              
              {item.commentsCount > 3 && (
                <TouchableOpacity onPress={() => navigation.navigate(ROUTES.POST_DETAIL, { postId: item.id })} style={styles.viewAllComments}>
                  <Text style={styles.viewAllCommentsText}>View all {item.commentsCount} comments</Text>
                </TouchableOpacity>
              )}

              {/* Smart Reply Suggestions */}
              <SmartReplySuggestions
                post={item}
                isDark={isDark}
                show={showSmartRepliesFor === item.id}
                onSelect={(reply) => handleSmartReplySelect(item.id, reply)}
              />

              <TouchableOpacity
                style={styles.smartReplyToggle}
                onPress={() => setShowSmartRepliesFor(showSmartRepliesFor === item.id ? null : item.id)}
              >
                <Ionicons name="bulb-outline" size={14} color={DS.primary} />
                <Text style={[styles.smartReplyToggleText, { color: DS.primary }]}>
                  {showSmartRepliesFor === item.id ? 'Hide smart replies' : 'Show smart replies ✨'}
                </Text>
              </TouchableOpacity>

              <View style={styles.commentInputBox}>
                <SafeAvatar avatar={currentUser?.avatar} size={32} fallbackIcon="person" fallbackColor={DS.primary} fallbackBgColor={`${DS.primary}15`} />
                <View style={[styles.commentInputWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray50 }]}>
                  <TextInput
                    style={[styles.commentInput, { color: isDark ? DS.white : DS.gray800 }]}
                    placeholder={replyingTo?.postId === item.id ? 'Write a reply...' : 'Add a comment...'}
                    placeholderTextColor={DS.gray400}
                    value={commentInputs[item.id] || ''}
                    onChangeText={t => setCommentInputs(prev => ({ ...prev, [item.id]: t }))}
                    multiline
                    maxLength={500}
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, !commentInputs[item.id]?.trim() && styles.sendBtnDisabled]}
                    onPress={() => handleCommentSubmit(item.id)}
                    disabled={!commentInputs[item.id]?.trim()}
                  >
                    <LinearGradient
                      colors={commentInputs[item.id]?.trim() ? [DS.primary, DS.primaryDark] : [DS.gray200, DS.gray200]}
                      style={styles.sendBtnGrad}
                    >
                      <Ionicons name="arrow-up" size={14} color={DS.white} />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </Animated.View>
    );
  }, [isDark, currentUser, topics, expandedPostId, commentInputs, replyingTo, showSmartRepliesFor, handleLike, handleRepost, handleBookmark, handleShare, handleCommentSubmit, handleVotePoll, handleSmartReplySelect, navigation, moderationService]);

  // ============================================================
  // RENDER HEADER
  // ============================================================
  const renderHeader = useCallback(() => (
    <View>
      {/* Hero Banner */}
      <View style={[styles.heroBanner, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
        <LinearGradient
          colors={isDark ? ['rgba(99,102,241,0.15)', 'rgba(236,72,153,0.08)'] : ['rgba(99,102,241,0.06)', 'rgba(236,72,153,0.03)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroContent}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={[styles.heroTitle, { color: isDark ? DS.white : DS.gray900 }]}>The Loom</Text>
              <Text style={[styles.heroSubtitle, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                Weave stories, share wisdom, grow together.
              </Text>
            </View>
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={[styles.heroStatValue, { color: DS.primary }]}>{postsCount}</Text>
                <Text style={[styles.heroStatLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Posts</Text>
              </View>
              <View style={[styles.heroStatDivider, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
              <View style={styles.heroStat}>
                <Text style={[styles.heroStatValue, { color: DS.accent }]}>{membersCount}</Text>
                <Text style={[styles.heroStatLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Members</Text>
              </View>
            </View>
          </View>
          <View style={styles.heroActions}>
            <TouchableOpacity style={[styles.heroActionBtn, { backgroundColor: DS.primary }]} onPress={() => {
              if (!canInteract) {
                sweetAlert.alert('Sign In Required', 'Please sign in to post', 'warning');
                return;
              }
              navigation.navigate(ROUTES.CREATE_POST);
            }}>
              <Ionicons name="create-outline" size={16} color={DS.white} />
              <Text style={styles.heroActionText}>Start Thread</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.heroActionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]} onPress={() => navigation.navigate(ROUTES.TOPICS, { topicId: topics[0]?.id })}>
              <Ionicons name="compass-outline" size={16} color={isDark ? DS.gray300 : DS.gray600} />
              <Text style={[styles.heroActionText, { color: isDark ? DS.gray300 : DS.gray600 }]}>Explore</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Smart Topic Recommendations */}
      <SmartTopicRecommendations
        posts={posts}
        topics={topics}
        isDark={isDark}
        onSelect={(topicId) => setActiveTopic(topicId)}
      />

      {/* Compose Bar */}
      <View style={[styles.composeBar, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
        <TouchableOpacity
          style={styles.composeInput}
          onPress={() => {
            if (!canInteract) {
              sweetAlert.alert('Sign In Required', 'Please sign in to post', 'warning');
              return;
            }
            navigation.navigate(ROUTES.CREATE_POST);
          }}
        >
          <View style={[styles.composeInputInner, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray50 }]}>
            <Ionicons name="create-outline" size={18} color={DS.gray400} />
            <Text style={[styles.composePlaceholder, { color: DS.gray400 }]}>What's on your mind, parent?</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Topic Filter */}
      <View style={styles.topicFilterRow}>
        <TouchableOpacity
          style={[styles.topicFilterPill, activeTopic === 'all' && { backgroundColor: DS.primary }]}
          onPress={() => setActiveTopic('all')}
        >
          <Text style={[styles.topicFilterText, activeTopic === 'all' && { color: DS.white }]}>All</Text>
        </TouchableOpacity>
        {topics.slice(0, 6).map((topic) => (
          <TouchableOpacity
            key={topic.id}
            style={[styles.topicFilterPill, activeTopic === topic.id && { backgroundColor: topic.color }]}
            onPress={() => setActiveTopic(activeTopic === topic.id ? 'all' : topic.id)}
          >
            <Text style={styles.topicFilterEmoji}>{topic.emoji}</Text>
            <Text style={[styles.topicFilterText, activeTopic === topic.id && { color: DS.white }]}>
              {topic.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  ), [isDark, topics, postsCount, membersCount, canInteract, activeTopic, posts, navigation, sweetAlert]);

  // ============================================================
  // RENDER FOOTER
  // ============================================================
  const renderFooter = useCallback(() => {
    if (!loadingMore) return <View style={{ height: 120 }} />;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={DS.primary} />
        <Text style={[styles.footerLoaderText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
          Weaving more threads...
        </Text>
      </View>
    );
  }, [loadingMore, isDark]);

  // ============================================================
  // RENDER EMPTY
  // ============================================================
  const renderEmpty = useCallback(() => (
    <View style={styles.emptyState}>
      <LinearGradient colors={isDark ? [`${DS.primary}20`, `${DS.primaryDark}20`] : [`${DS.primary}12`, `${DS.primaryDark}12`]} style={styles.emptyIconBg}>
        <Ionicons name="chatbubbles-outline" size={40} color={DS.primary} />
      </LinearGradient>
      <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray600 }]}>
        {searchQuery ? 'No threads found' : 'The Loom is quiet'}
      </Text>
      <Text style={[styles.emptyText, { color: isDark ? DS.gray400 : DS.gray400 }]}>
        {searchQuery ? 'Try different words or browse by topic' : 'Be the first to weave a story into the community!'}
      </Text>
      {!searchQuery && (
        <TouchableOpacity style={styles.emptyBtn} onPress={() => {
          if (!canInteract) {
            sweetAlert.alert('Sign In Required', 'Please sign in to start a thread', 'warning');
            return;
          }
          navigation.navigate(ROUTES.CREATE_POST);
        }}>
          <LinearGradient colors={[DS.primary, DS.primaryDark]} style={styles.emptyBtnGrad}>
            <Text style={styles.emptyBtnText}>Start a Thread</Text>
            <Ionicons name="arrow-forward" size={14} color={DS.white} />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  ), [isDark, searchQuery, canInteract, navigation, sweetAlert]);

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

        {/* Header */}
        <Animated.View style={[styles.header, {
          backgroundColor: isDark ? 'rgba(12,10,9,0.92)' : 'rgba(255,255,255,0.92)',
          borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray200,
          borderBottomWidth: 1,
        }]}>
          <View style={styles.headerInner}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image source={littleLoomLogo} style={[styles.headerLogo]} resizeMode="contain" />
              <View style={{ marginLeft: 8 }}>
                <Text style={[styles.headerTitle, { color: isDark ? DS.white : DS.gray900 }]}>LittleLoom</Text>
                <LinearGradient colors={['#6366f1', '#ec4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.headerSubtitleGradient}>
                  <Text style={styles.headerSubtitleText}>THE LOOM</Text>
                </LinearGradient>
              </View>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={() => setShowSearch(!showSearch)} style={styles.headerIconBtn}>
                <View style={[styles.headerIconInner, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : `${DS.primary}10` }]}>
                  <Ionicons name={showSearch ? 'close' : 'search'} size={20} color={isDark ? DS.primaryLight : DS.primary} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowNotificationChooser(true)} style={styles.headerIconBtn}>
                <View style={[styles.headerIconInner, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : `${DS.primary}10` }]}>
                  <Ionicons name="notifications-outline" size={20} color={isDark ? DS.primaryLight : DS.primary} />
                  {unreadCount > 0 && (
                    <View style={styles.headerBadge}>
                      <LinearGradient colors={[DS.accent, DS.accentLight]} style={styles.headerBadgeGrad}>
                        <Text style={styles.headerBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                      </LinearGradient>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate(ROUTES.MESSAGES)} style={styles.headerIconBtn}>
                <View style={[styles.headerIconInner, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : `${DS.primary}10` }]}>
                  <Ionicons name="mail-outline" size={20} color={isDark ? DS.primaryLight : DS.primary} />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {showBanner && (
          <Animated.View entering={SlideInDown.duration(350).springify()} exiting={SlideOutUp.duration(200)} style={styles.bannerWrap}>
            <TouchableOpacity onPress={handleScrollToNew}>
              <LinearGradient colors={[DS.primary, DS.primaryDark]} style={styles.bannerGradient}>
                <Ionicons name="sparkles" size={16} color={DS.white} />
                <Text style={styles.bannerText}>{newPostsCount} new thread{newPostsCount > 1 ? 's' : ''} woven</Text>
                <Ionicons name="arrow-up" size={14} color={DS.white} />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {showSearch && (
          <Animated.View entering={FadeInDown.duration(250)} exiting={FadeOut.duration(200)} style={[styles.searchBarContainer, { backgroundColor: isDark ? DS.darkCard : DS.white, marginTop: HEADER_TOTAL_HEIGHT + 8 }]}>
            <View style={[styles.searchBarInner, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray50 }]}>
              <Ionicons name="search" size={18} color={DS.gray400} />
              <TextInput
                style={[styles.searchInput, { color: isDark ? DS.white : DS.gray800 }]}
                placeholder="Search threads, topics, parents..."
                placeholderTextColor={DS.gray400}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={DS.gray400} />
                </TouchableOpacity>
              )}
            </View>
            {searchQuery.trim().length > 0 && (
              <TouchableOpacity style={styles.searchPeopleBtn} onPress={() => navigation.navigate(ROUTES.SEARCH_USERS, { initialQuery: searchQuery.trim() })}>
                <Ionicons name="people-outline" size={16} color={DS.primary} />
                <Text style={[styles.searchPeopleText, { color: DS.primary }]}>Find parents matching "{searchQuery.trim()}"</Text>
                <Ionicons name="chevron-forward" size={14} color={DS.primary} />
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        {isLoading ? (
          <View style={[styles.listContent, { paddingTop: HEADER_TOTAL_HEIGHT + 10 }]}>
            {[1, 2, 3].map(i => <PostSkeleton key={i} isDark={isDark} />)}
          </View>
        ) : (
          <Animated.FlatList
            ref={listRef as any}
            data={displayedPosts}
            renderItem={renderPost}
            keyExtractor={item => item.id}
            contentContainerStyle={[styles.listContent, { paddingTop: HEADER_TOTAL_HEIGHT + 10 }]}
            showsVerticalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            removeClippedSubviews={Platform.OS === 'android'}
            overScrollMode="never"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={DS.primary}
                colors={[DS.primary]}
                progressBackgroundColor={isDark ? DS.darkSurface : DS.white}
                progressViewOffset={Platform.OS === 'ios' ? HEADER_TOTAL_HEIGHT : HEADER_TOTAL_HEIGHT - 20}
              />
            }
            onEndReached={onLoadMore}
            onEndReachedThreshold={0.4}
            ListHeaderComponent={renderHeader}
            ListFooterComponent={renderFooter}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            ListEmptyComponent={renderEmpty}
          />
        )}

        {/* Notification Modal */}
        <Modal visible={showNotificationChooser} transparent animationType="fade" onRequestClose={() => setShowNotificationChooser(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowNotificationChooser(false)}>
            <View style={[styles.notificationModal, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
              <View style={styles.notificationModalHeader}>
                <Text style={[styles.notificationModalTitle, { color: isDark ? DS.white : DS.gray900 }]}>Notifications</Text>
                <TouchableOpacity onPress={() => setShowNotificationChooser(false)}>
                  <Ionicons name="close" size={24} color={isDark ? DS.gray400 : DS.gray500} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.notificationOption} onPress={() => {
                setShowNotificationChooser(false);
                navigation.navigate(ROUTES.NOTIFICATIONS);
              }}>
                <View style={[styles.notificationIconWrap, { backgroundColor: `${DS.primary}15` }]}>
                  <Ionicons name="notifications" size={20} color={DS.primary} />
                </View>
                <View style={styles.notificationOptionTextWrap}>
                  <Text style={[styles.notificationOptionTitle, { color: isDark ? DS.white : DS.gray900 }]}>All Notifications</Text>
                  <Text style={[styles.notificationOptionDesc, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                    {unreadCount > 0 ? `${unreadCount} unread` : 'No new notifications'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={DS.gray400} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.notificationOption} onPress={() => {
                setShowNotificationChooser(false);
                markAllNotificationsRead();
                sweetAlert.alert('Success', 'All notifications marked as read', 'success');
              }}>
                <View style={[styles.notificationIconWrap, { backgroundColor: `${DS.success}15` }]}>
                  <Ionicons name="checkmark-done" size={20} color={DS.success} />
                </View>
                <View style={styles.notificationOptionTextWrap}>
                  <Text style={[styles.notificationOptionTitle, { color: isDark ? DS.white : DS.gray900 }]}>Mark All as Read</Text>
                  <Text style={[styles.notificationOptionDesc, { color: isDark ? DS.gray400 : DS.gray500 }]}>Clear all notification badges</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={DS.gray400} />
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        {/* FAB */}
        <Animated.View entering={FadeIn.delay(600).duration(400)} style={styles.fabWrap}>
          <TouchableOpacity
            style={styles.fab}
            onPress={() => {
              if (!canInteract) {
                sweetAlert.alert('Sign In Required', 'Please sign in to weave a thread', 'warning');
                return;
              }
              navigation.navigate(ROUTES.CREATE_POST);
            }}
            activeOpacity={0.85}
          >
            <LinearGradient colors={[DS.primary, DS.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabGrad}>
              <Ionicons name="add" size={28} color={DS.white} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </GestureHandlerRootView>
  );
}

// ============================================================
// POLL WIDGET (unchanged)
// ============================================================
const PollWidget = React.memo(({
  poll,
  postId,
  onVote,
  isDark,
}: {
  poll: Poll;
  postId: string;
  onVote: (postId: string, optionId: string) => void;
  isDark: boolean;
}) => {
  return (
    <View style={[styles.pollWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.gray50 }]}>
      <Text style={[styles.pollQuestion, { color: isDark ? DS.white : DS.gray800 }]}>{poll.question}</Text>
      {poll.options.map((option) => {
        const percentage = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
        const isSelected = poll.votedOptionId === option.id;
        return (
          <Pressable key={option.id} onPress={() => !poll.hasVoted && onVote(postId, option.id)} style={styles.pollOption}>
            <View style={styles.pollTrack}>
              {poll.hasVoted && (
                <Animated.View entering={FadeIn.duration(600)} style={[styles.pollFill, { width: `${percentage}%`, backgroundColor: isSelected ? DS.primary : `${DS.primary}25` }]} />
              )}
              <View style={styles.pollOptionContent}>
                <Text style={[styles.pollOptionText, { color: isDark ? DS.gray200 : DS.gray700 }]}>{option.text}</Text>
                {poll.hasVoted && <Text style={[styles.pollPercent, { color: isSelected ? DS.primary : DS.gray400 }]}>{percentage}%</Text>}
              </View>
            </View>
          </Pressable>
        );
      })}
      <Text style={[styles.pollMeta, { color: isDark ? DS.gray500 : DS.gray400 }]}>
        {poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}
        {!poll.hasVoted && ' · Tap to vote'}
      </Text>
    </View>
  );
});

// ============================================================
// POST SKELETON (unchanged)
// ============================================================
const PostSkeleton = React.memo(({ isDark }: { isDark: boolean }) => {
  return (
    <View style={[styles.postCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200, marginBottom: DS.space.lg, padding: DS.space.lg }]}>
      <View style={styles.skeletonHeader}>
        <View style={[styles.skeletonAvatar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f0f2ff' }]} />
        <View style={styles.skeletonTextBlock}>
          <View style={[styles.skeletonLine, { width: '45%', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f0f2ff' }]} />
          <View style={[styles.skeletonLine, { width: '28%', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#e2e8f0' }]} />
        </View>
      </View>
      <View style={{ paddingVertical: DS.space.md, gap: DS.space.sm }}>
        <View style={[styles.skeletonLine, { width: '100%', height: 14, borderRadius: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
        <View style={[styles.skeletonLine, { width: '92%', height: 14, borderRadius: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
        <View style={[styles.skeletonLine, { width: '78%', height: 14, borderRadius: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2ff' }]} />
      </View>
    </View>
  );
});

// ============================================================
// STYLES (extended)
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingBottom: 120 },

  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: HEADER_TOP_PADDING,
    paddingBottom: DS.space.md,
    minHeight: HEADER_TOTAL_HEIGHT,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.lg,
    height: 48,
  },
  headerTitle: { fontSize: DS.text['2xl'].size, fontWeight: '800', letterSpacing: -0.5 },
  headerLogo: { width: 36, height: 36 },
  headerSubtitleGradient: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: DS.radius.sm, marginTop: 2, alignSelf: 'flex-start' },
  headerSubtitleText: { fontSize: 9, fontWeight: '800', color: DS.white, letterSpacing: 2, textTransform: 'uppercase' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm },
  headerIconBtn: { width: 38, height: 38, borderRadius: DS.radius.full },
  headerIconInner: { width: '100%', height: '100%', borderRadius: DS.radius.full, justifyContent: 'center', alignItems: 'center' },
  headerBadge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: DS.white, zIndex: 10 },
  headerBadgeGrad: { minWidth: 14, height: 14, borderRadius: 7, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  headerBadgeText: { color: DS.white, fontSize: 9, fontWeight: '800', lineHeight: 14, textAlign: 'center' },

  // Hero
  heroBanner: { marginHorizontal: DS.space.lg, marginTop: DS.space.md, marginBottom: DS.space.md, borderRadius: DS.radius.xl, padding: DS.space.lg, overflow: 'hidden', ...DS.shadow.md },
  heroContent: { zIndex: 1 },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTitle: { fontSize: DS.text.xl.size, fontWeight: '800', marginBottom: 2 },
  heroSubtitle: { fontSize: DS.text.sm.size },
  heroStats: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, paddingHorizontal: DS.space.md, paddingVertical: DS.space.sm, backgroundColor: 'rgba(99,102,241,0.06)', borderRadius: DS.radius.lg },
  heroStat: { alignItems: 'center' },
  heroStatValue: { fontSize: DS.text.xl.size, fontWeight: '800' },
  heroStatLabel: { fontSize: DS.text.xs.size, fontWeight: '600' },
  heroStatDivider: { width: 1, height: 24 },
  heroActions: { flexDirection: 'row', gap: DS.space.sm, marginTop: DS.space.md },
  heroActionBtn: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, paddingHorizontal: DS.space.lg, paddingVertical: DS.space.md, borderRadius: DS.radius.full },
  heroActionText: { fontSize: DS.text.sm.size, fontWeight: '700', color: DS.white },

  // Compose
  composeBar: { marginHorizontal: DS.space.lg, marginBottom: DS.space.md, borderRadius: DS.radius.xl, padding: DS.space.lg, ...DS.shadow.md, borderWidth: 1, borderColor: 'rgba(99,102,241,0.1)' },
  composeInput: { marginTop: DS.space.sm },
  composeInputInner: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, borderRadius: DS.radius.full, paddingHorizontal: DS.space.lg, paddingVertical: DS.space.md },
  composePlaceholder: { flex: 1, fontSize: DS.text.base.size },

  // Topic Filter
  topicFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: DS.space.sm, paddingHorizontal: DS.space.lg, marginBottom: DS.space.lg },
  topicFilterPill: { flexDirection: 'row', alignItems: 'center', gap: DS.space.xs, paddingHorizontal: DS.space.md, paddingVertical: DS.space.sm, borderRadius: DS.radius.full, backgroundColor: 'rgba(255,255,255,0.5)', borderWidth: 1, borderColor: DS.gray200 },
  topicFilterEmoji: { fontSize: 12 },
  topicFilterText: { fontSize: DS.text.xs.size, fontWeight: '600', color: DS.gray600 },

  // Post Card
  postCard: { borderRadius: DS.radius['2xl'], borderWidth: 1, overflow: 'hidden', marginHorizontal: DS.space.lg, marginBottom: DS.space.lg, ...DS.shadow.md },
  postHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: DS.space.lg },
  authorRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  authorInfo: { marginLeft: DS.space.md, flex: 1 },
  authorName: { fontSize: DS.text.base.size, fontWeight: '700' },
  handleText: { fontSize: DS.text.xs.size, fontWeight: '500' },
  postText: { fontSize: DS.text.base.size, lineHeight: 24, paddingHorizontal: DS.space.lg, marginBottom: DS.space.md },

  // Topic Tag
  topicTag: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginHorizontal: DS.space.lg, marginBottom: DS.space.md, paddingHorizontal: DS.space.md, paddingVertical: DS.space.sm, borderRadius: DS.radius.full, gap: DS.space.sm },
  topicDot: { width: 6, height: 6, borderRadius: 3 },
  topicTagText: { fontSize: DS.text.xs.size, fontWeight: '700' },

  // Media
  mediaBox: { marginHorizontal: DS.space.lg, marginBottom: DS.space.md, borderRadius: DS.radius.lg, overflow: 'hidden' },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  blurredImageWrap: { width: '100%', height: 280, borderRadius: DS.radius.lg, overflow: 'hidden', position: 'relative' },
  blurredImage: { width: '100%', height: '100%' },
  blurOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  blurIconWrap: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: DS.space.md },
  blurText: { fontSize: DS.text.base.size, fontWeight: '700', marginBottom: DS.space.xs },
  blurSubtext: { fontSize: DS.text.sm.size, fontWeight: '500' },
  showingContentBadge: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: DS.radius.full },
  showingContentText: { color: DS.white, fontSize: 10, fontWeight: '600' },

  // Blocked Image
  blockedImageContainer: { width: '100%', height: 200, borderRadius: DS.radius.lg, overflow: 'hidden' },
  blockedGradient: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: DS.space.sm },
  blockedImageText: { color: DS.white, fontSize: DS.text.lg.size, fontWeight: '700' },
  blockedImageTextSmall: { color: DS.white, fontSize: DS.text.sm.size, fontWeight: '600' },
  blockedImageSubtext: { color: 'rgba(255,255,255,0.7)', fontSize: DS.text.sm.size },

  // Moderation
  moderationWrap: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, paddingHorizontal: DS.space.lg, paddingVertical: DS.space.sm, marginBottom: DS.space.sm },
  moderationText: { fontSize: DS.text.xs.size, fontWeight: '600' },

  // Sentiment
  sentimentWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: DS.space.lg, paddingVertical: DS.space.sm, gap: DS.space.sm, marginBottom: DS.space.sm },
  sentimentEmoji: { fontSize: 14 },
  sentimentBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: DS.gray200, overflow: 'hidden' },
  sentimentFill: { height: '100%', borderRadius: 2 },
  sentimentLabel: { fontSize: DS.text.xs.size, fontWeight: '600' },
  emotionTags: { flexDirection: 'row', gap: DS.space.xs },
  emotionTag: { paddingHorizontal: DS.space.sm, paddingVertical: 2, borderRadius: DS.radius.full },
  emotionTagText: { fontSize: 9, fontWeight: '600' },

  // Summary
  summaryWrap: { marginHorizontal: DS.space.lg, marginBottom: DS.space.md, padding: DS.space.md, borderRadius: DS.radius.md },
  summaryToggle: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm },
  summaryToggleText: { fontSize: DS.text.sm.size, fontWeight: '700' },
  summaryContent: { marginTop: DS.space.sm },
  summaryText: { fontSize: DS.text.sm.size, fontWeight: '600', marginBottom: DS.space.xs },
  summaryFull: { fontSize: DS.text.sm.size, lineHeight: 20 },

  // Prediction
  predictionWrap: { marginHorizontal: DS.space.lg, marginBottom: DS.space.md, padding: DS.space.md, borderRadius: DS.radius.md },
  predictionHeader: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, marginBottom: DS.space.sm },
  predictionTitle: { fontSize: DS.text.sm.size, fontWeight: '600', flex: 1 },
  trendingPredictionBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: `${DS.warning}15`, paddingHorizontal: DS.space.sm, paddingVertical: 2, borderRadius: DS.radius.full },
  trendingPredictionText: { fontSize: 9, fontWeight: '700', color: DS.warning },
  predictionStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: DS.space.sm },
  predictionStat: { alignItems: 'center' },
  predictionStatValue: { fontSize: DS.text.lg.size, fontWeight: '700' },
  predictionStatLabel: { fontSize: DS.text.xs.size, fontWeight: '500' },
  predictionDivider: { width: 1, height: 24 },
  predictionConfidence: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm },
  confidenceBar: { flex: 1, height: 3, borderRadius: 1.5, overflow: 'hidden' },
  confidenceFill: { height: '100%', borderRadius: 1.5 },
  confidenceText: { fontSize: DS.text.xs.size, fontWeight: '500' },

  // Smart Reply
  smartReplyWrap: { marginBottom: DS.space.md, padding: DS.space.md, borderRadius: DS.radius.md, ...DS.shadow.sm },
  smartReplyHeader: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, marginBottom: DS.space.sm },
  smartReplyTitle: { fontSize: DS.text.sm.size, fontWeight: '700' },
  smartReplySubtitle: { fontSize: DS.text.xs.size, fontWeight: '500' },
  smartReplyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: DS.space.sm },
  smartReplyChip: { paddingHorizontal: DS.space.md, paddingVertical: DS.space.sm, borderRadius: DS.radius.full },
  smartReplyChipText: { fontSize: DS.text.xs.size, fontWeight: '600' },
  smartReplyToggle: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, paddingVertical: DS.space.sm },
  smartReplyToggleText: { fontSize: DS.text.sm.size, fontWeight: '600' },

  // Topic Recommendations
  topicRecWrap: { marginHorizontal: DS.space.lg, marginBottom: DS.space.md, padding: DS.space.md, borderRadius: DS.radius.lg },
  topicRecHeader: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, marginBottom: DS.space.md },
  topicRecTitle: { fontSize: DS.text.sm.size, fontWeight: '700' },
  topicRecSubtitle: { fontSize: DS.text.xs.size, fontWeight: '500' },
  topicRecList: { gap: DS.space.sm },
  topicRecItem: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md, borderRadius: DS.radius.md, ...DS.shadow.sm },
  topicRecIcon: { width: 40, height: 40, borderRadius: DS.radius.md, justifyContent: 'center', alignItems: 'center' },
  topicRecEmoji: { fontSize: 20 },
  topicRecInfo: { flex: 1 },
  topicRecName: { fontSize: DS.text.sm.size, fontWeight: '600' },
  topicRecDesc: { fontSize: DS.text.xs.size, fontWeight: '500' },

  // Engagement Bar
  engagementBar: { paddingHorizontal: DS.space.lg, paddingBottom: DS.space.sm },
  engagementText: { fontSize: DS.text.xs.size, fontWeight: '500' },

  // Reaction Bar
  reactionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: DS.space.lg, paddingVertical: DS.space.md, borderTopWidth: 1 },
  reactionBtn: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, paddingVertical: DS.space.sm },
  reactionCount: { fontSize: DS.text.sm.size, color: DS.gray400, fontWeight: '600' },

  // Comments
  commentsBox: { borderTopWidth: 1, padding: DS.space.lg },
  inlineComment: { flexDirection: 'row', alignItems: 'flex-start', gap: DS.space.sm, marginBottom: DS.space.md },
  inlineCommentContent: { flex: 1 },
  inlineCommentBubble: { borderRadius: DS.radius.lg, paddingHorizontal: DS.space.md, paddingVertical: DS.space.sm },
  inlineCommentAuthor: { fontSize: DS.text.sm.size, fontWeight: '700', marginBottom: 2 },
  inlineCommentText: { fontSize: DS.text.sm.size, lineHeight: 20 },
  viewAllComments: { flexDirection: 'row', alignItems: 'center', gap: DS.space.xs, marginBottom: DS.space.md },
  viewAllCommentsText: { fontSize: DS.text.sm.size, color: DS.primary, fontWeight: '700' },
  commentInputBox: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm },
  commentInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: DS.radius.full, borderWidth: 1, borderColor: DS.gray200, paddingHorizontal: DS.space.md, paddingVertical: 2 },
  commentInput: { flex: 1, fontSize: DS.text.sm.size, paddingVertical: DS.space.md, maxHeight: 80 },
  sendBtn: { width: 32, height: 32, borderRadius: DS.radius.full, overflow: 'hidden' },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnGrad: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },

  // Poll
  pollWrap: { borderRadius: DS.radius.lg, padding: DS.space.md },
  pollQuestion: { fontSize: DS.text.sm.size, fontWeight: '700', marginBottom: DS.space.md },
  pollOption: { marginBottom: DS.space.sm },
  pollTrack: { height: 40, borderRadius: DS.radius.md, overflow: 'hidden', justifyContent: 'center' },
  pollFill: { ...StyleSheet.absoluteFillObject, borderRadius: DS.radius.md },
  pollOptionContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DS.space.md, zIndex: 1 },
  pollOptionText: { fontSize: DS.text.sm.size, fontWeight: '600' },
  pollPercent: { fontSize: DS.text.sm.size, fontWeight: '800' },
  pollMeta: { fontSize: DS.text.xs.size, marginTop: DS.space.sm },

  // Skeleton
  skeletonHeader: { flexDirection: 'row', alignItems: 'center' },
  skeletonAvatar: { width: 44, height: 44, borderRadius: 22 },
  skeletonTextBlock: { marginLeft: DS.space.md, gap: DS.space.sm, flex: 1 },
  skeletonLine: { height: 12, borderRadius: DS.radius.sm },

  // Banner
  bannerWrap: { position: 'absolute', top: HEADER_TOTAL_HEIGHT + 8, left: 0, right: 0, zIndex: 90, alignItems: 'center', paddingHorizontal: DS.space.lg },
  bannerGradient: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, paddingHorizontal: DS.space.xl, paddingVertical: DS.space.md, borderRadius: DS.radius.full, ...DS.shadow.md },
  bannerText: { color: DS.white, fontSize: DS.text.sm.size, fontWeight: '700' },

  // Search
  searchBarContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 95, paddingHorizontal: DS.space.lg, paddingVertical: DS.space.md, borderRadius: DS.radius.lg, marginHorizontal: DS.space.lg, ...DS.shadow.md },
  searchBarInner: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, borderRadius: DS.radius.full, paddingHorizontal: DS.space.md, paddingVertical: DS.space.sm },
  searchInput: { flex: 1, fontSize: DS.text.base.size, paddingVertical: 4 },
  searchPeopleBtn: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, paddingHorizontal: DS.space.sm, paddingVertical: DS.space.md, marginTop: DS.space.xs },
  searchPeopleText: { flex: 1, fontSize: DS.text.sm.size, fontWeight: '600' },

  // Empty
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: DS.space['2xl'] },
  emptyIconBg: { width: 80, height: 80, borderRadius: DS.radius['2xl'], justifyContent: 'center', alignItems: 'center', marginBottom: DS.space.lg },
  emptyTitle: { fontSize: DS.text.xl.size, fontWeight: '800', marginBottom: DS.space.sm, textAlign: 'center' },
  emptyText: { fontSize: DS.text.base.size, textAlign: 'center', marginBottom: DS.space.xl, lineHeight: 22 },
  emptyBtn: { borderRadius: DS.radius.full, overflow: 'hidden' },
  emptyBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, paddingHorizontal: DS.space.xl, paddingVertical: DS.space.md },
  emptyBtnText: { color: DS.white, fontSize: DS.text.sm.size, fontWeight: '700' },

  // FAB
  fabWrap: { position: 'absolute', bottom: 30, right: DS.space.lg, zIndex: 100, alignItems: 'center' },
  fab: { width: 58, height: 58, borderRadius: 29, overflow: 'hidden', ...DS.shadow.lg },
  fabGrad: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: DS.space.lg },
  notificationModal: { width: '100%', maxWidth: 360, borderRadius: DS.radius.xl, padding: DS.space.lg, ...DS.shadow.lg },
  notificationModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: DS.space.lg },
  notificationModalTitle: { fontSize: DS.text.xl.size, fontWeight: '700' },
  notificationOption: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, paddingVertical: DS.space.md, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  notificationIconWrap: { width: 40, height: 40, borderRadius: DS.radius.md, justifyContent: 'center', alignItems: 'center' },
  notificationOptionTextWrap: { flex: 1 },
  notificationOptionTitle: { fontSize: DS.text.base.size, fontWeight: '600' },
  notificationOptionDesc: { fontSize: DS.text.xs.size, marginTop: 2 },

  // Footer
  footerLoader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: DS.space.sm, paddingVertical: DS.space.xl },
  footerLoaderText: { fontSize: DS.text.sm.size, fontWeight: '600' },
});