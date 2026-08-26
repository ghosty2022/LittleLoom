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
  'react-native/Libraries/Renderer/shims/ReactNative': path.resolve(__dirname, 'src/shim/ReactNative.js'),
};

module.exports = config;