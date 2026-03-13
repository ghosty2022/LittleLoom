import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, StackScreenProps } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

// Auth Screens
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import CreateBabyProfileScreen from '../screens/CreateBabyProfileScreen';

// Main Screens
import HomeScreen from '../screens/HomeScreen';
import TimelineScreen from '../screens/TimelineScreen';
import CustomizeScreen from '../screens/CustomizeScreen';
import SettingsScreen from '../screens/SettingsScreen';

// Community Screens
import CommunityScreen from '../screens/community/CommunityScreen';
import TopicScreen from '../screens/community/TopicScreen';
import CreatePostScreen from '../screens/community/CreatePostScreen';
import PostDetailScreen from '../screens/community/PostDetailScreen';
import ChatScreen from '../screens/community/ChatScreen';
import UserProfileScreen from '../screens/community/UserProfileScreen';
import NotificationsScreen from '../screens/community/NotificationsScreen';

// Modal Screens
import AddLogScreen from '../screens/AddLogScreen';
import AchievementsScreen from '../screens/AchievementsScreen';
import GrowthChartScreen from '../screens/GrowthChartScreen';
import RemindersScreen from '../screens/RemindersScreen';
import FamilySharingScreen from '../screens/FamilySharingScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import SoundMixerScreen from '../screens/SoundMixerScreen';

// Components
import LiquidGlassNavigation from '../components/LiquidGlassNavigation';

// Type Definitions
export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  CreateBabyProfile: undefined;
  Main: undefined;
  AddLog: { type?: string } | undefined;
  Achievements: undefined;
  GrowthChart: undefined;
  Reminders: undefined;
  FamilySharing: undefined;
  EditProfile: undefined;
  SoundMixer: undefined;
};

export type CommunityStackParamList = {
  CommunityMain: undefined;
  Topic: { topicId: string };
  CreatePost: { topicId?: string };
  PostDetail: { postId: string };
  Chat: { userId: string };
  UserProfile: { userId: string };
  Notifications: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Community: undefined;
  Timeline: undefined;
  Customize: undefined;
  Settings: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const CommunityStackNavigator = createStackNavigator<CommunityStackParamList>();

// Community Stack
function CommunityStack() {
  return (
    <CommunityStackNavigator.Navigator screenOptions={{ headerShown: false }}>
      <CommunityStackNavigator.Screen name="CommunityMain" component={CommunityScreen} />
      <CommunityStackNavigator.Screen name="Topic" component={TopicScreen} />
      <CommunityStackNavigator.Screen name="CreatePost" component={CreatePostScreen} />
      <CommunityStackNavigator.Screen name="PostDetail" component={PostDetailScreen} />
      <CommunityStackNavigator.Screen name="Chat" component={ChatScreen} />
      <CommunityStackNavigator.Screen name="UserProfile" component={UserProfileScreen} />
      <CommunityStackNavigator.Screen name="Notifications" component={NotificationsScreen} />
    </CommunityStackNavigator.Navigator>
  );
}

// Main Tabs with Liquid Glass Navigation
function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <LiquidGlassNavigation {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Community" component={CommunityStack} />
      <Tab.Screen name="Timeline" component={TimelineScreen} />
      <Tab.Screen name="Customize" component={CustomizeScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

// Root Navigator
export default function AppNavigator() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {/* Auth Flow */}
          <Stack.Group>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="CreateBabyProfile" component={CreateBabyProfileScreen} />
          </Stack.Group>
          
          {/* Main App */}
          <Stack.Screen name="Main" component={MainTabs} />
          
          {/* Global Modals - Transparent Modal Presentation */}
          <Stack.Group screenOptions={{ 
            presentation: 'modal',
            cardStyle: { backgroundColor: 'transparent' },
            cardOverlayEnabled: true,
          }}>
            <Stack.Screen name="AddLog" component={AddLogScreen} />
            <Stack.Screen name="Achievements" component={AchievementsScreen} />
            <Stack.Screen name="GrowthChart" component={GrowthChartScreen} />
            <Stack.Screen name="Reminders" component={RemindersScreen} />
            <Stack.Screen name="FamilySharing" component={FamilySharingScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="SoundMixer" component={SoundMixerScreen} />
          </Stack.Group>
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});