// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ─── SVG Support ──────────────────────────────────────────────────────
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

// ─── Source extensions ──────────────────────────────────────────────
config.resolver = {
  ...config.resolver,
  sourceExts: ['js', 'jsx', 'ts', 'tsx', 'json', 'cjs', 'mjs', 'svg'],
  assetExts: config.resolver.assetExts.filter((ext) => ext !== 'svg'),
  alias: {
    '@': path.resolve(__dirname, 'src'),
    '@components': path.resolve(__dirname, 'src/components'),
    '@screens': path.resolve(__dirname, 'src/screens'),
    '@navigation': path.resolve(__dirname, 'src/navigation'),
    '@context': path.resolve(__dirname, 'src/context'),
    '@utils': path.resolve(__dirname, 'src/utils'),
    '@hooks': path.resolve(__dirname, 'src/hooks'),
    '@services': path.resolve(__dirname, 'src/services'),
    '@assets': path.resolve(__dirname, 'assets'),
    '@types': path.resolve(__dirname, 'src/types'),
    '@theme': path.resolve(__dirname, 'src/theme'),
    '@providers': path.resolve(__dirname, 'src/providers'),
  },
  blockList: [
    /[\/\\]executorch-env[\/\\].*/,
  ],
};

module.exports = config;