// src/shim/ReactNative.js
// This is a shim for react-native-reanimated to find the ReactNative module
// The actual ReactNative module from react-native
import * as ReactNative from 'react-native';

// Export everything from react-native
export default ReactNative;
export * from 'react-native';