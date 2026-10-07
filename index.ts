// index.ts
import 'react-native-url-polyfill/auto';
import 'expo-dev-client';
import { registerRootComponent } from 'expo';
import App from './App';

// Register background tasks (must run before the app mounts)
import './src/services/registerBackgroundTasks';

registerRootComponent(App);