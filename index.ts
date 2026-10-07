
import 'react-native-url-polyfill/auto';
import 'expo-dev-client';
import { registerRootComponent } from 'expo';
import App from './App';


import './src/services/registerBackgroundTasks';

registerRootComponent(App);