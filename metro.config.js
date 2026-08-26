// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ─── Performance: Inline requires for faster startup ─────────────────
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

// ─── SVG Support ──────────────────────────────────────────────────────
// ⚠️ ONLY enable if react-native-svg-transformer is INSTALLED
// If you get "React is not defined" errors, keep this commented out:
/*
try {
  config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');
} catch (e) {
  console.warn('[metro] react-native-svg-transformer not found, SVG support disabled');
}
*/

// ─── Source extensions ──────────────────────────────────────────────
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'cjs',
  'mjs',
  'svg',
];

// ─── Asset extensions ────────────────────────────────────────────────
config.resolver.assetExts = [
  ...config.resolver.assetExts.filter(ext => ext !== 'svg'),
  'ttf',
  'otf',
  'woff',
  'woff2',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'mp3',
  'mp4',
  'wav',
  'db',
  'sqlite',
  'sql',
];

// ─── Path alias for @/ imports ──────────────────────────────────────
config.resolver.alias = {
  '@': path.resolve(__dirname, 'src'),
};

// ─── FIX: React Native shims for React 19 ──────────────────────────
// This resolves the "react-native/Libraries/Renderer/shims/ReactNative" error
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Fix for React Native shims path in React 19
  if (moduleName === 'react-native/Libraries/Renderer/shims/ReactNative') {
    // Try to resolve the actual path
    try {
      const resolvedPath = require.resolve('react-native/Libraries/Renderer/shims/ReactNative');
      return {
        filePath: resolvedPath,
        type: 'sourceFile',
      };
    } catch (e) {
      // If the file doesn't exist, try alternative paths
      const alternatives = [
        'react-native/Libraries/ReactNative/ReactNative',
        'react-native/Libraries/Renderer/shims/ReactNative',
        'react-native/Libraries/Renderer/ReactNative',
      ];
      
      for (const alt of alternatives) {
        try {
          const resolvedPath = require.resolve(alt);
          return {
            filePath: resolvedPath,
            type: 'sourceFile',
          };
        } catch (e2) {
          // Continue trying
        }
      }
      
      // If all fail, fallback to original resolver
      return context.resolveRequest(context, moduleName, platform);
    }
  }
  
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;