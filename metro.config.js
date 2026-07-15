const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ─── Performance: Inline requires for faster startup ─────────────────
// Reduces TTI by loading modules on-demand instead of upfront
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

// ─── SVG Support ──────────────────────────────────────────────────────
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');

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

// ─── Cache reset (development only, remove for production builds) ────
// config.resetCache = true; // Uncomment only when clearing cache

module.exports = config;