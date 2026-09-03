const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Get the default config
const config = getDefaultConfig(__dirname);

// ─── SVG Support ──────────────────────────────────────────────────────
const { transformer, resolver } = config;

// Add SVG transformer support properly
config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

// ─── Source extensions ──────────────────────────────────────────────
config.resolver = {
  ...resolver,
  sourceExts: ['js', 'jsx', 'ts', 'tsx', 'json', 'cjs', 'mjs', 'svg'],
  assetExts: resolver.assetExts.filter(ext => ext !== 'svg'),
  alias: {
    '@': path.resolve(__dirname, 'src'),
  },
};

// ─── Watch folders for better performance ──────────────────────────
config.watchFolders = [path.resolve(__dirname, 'src')];

// ─── Max workers for better performance ────────────────────────────
config.maxWorkers = 4;

module.exports = config;