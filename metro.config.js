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
// Only apply SVG transformer if react-native-svg-transformer is installed
try {
  config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');
} catch (e) {
  console.warn('[metro] react-native-svg-transformer not found, SVG support disabled');
}

// ─── Source extensions ──────────────────────────────────────────────
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'cjs',
  'mjs',
  'svg',
];

// ─── Asset extensions (Metro serves these as static files) ───────────
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
];

// ─── Path alias for @/ imports ──────────────────────────────────────
config.resolver.alias = {
  '@': path.resolve(__dirname, 'src'),
};

module.exports = config;