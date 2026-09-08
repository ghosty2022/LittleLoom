// metro.config.js
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
  // Enable Fast Refresh improvements
  minifierConfig: {
    mangle: false,
    keep_classnames: true,
    keep_fnames: true,
  },
};

// ─── Source extensions ──────────────────────────────────────────────
config.resolver = {
  ...resolver,
  sourceExts: ['js', 'jsx', 'ts', 'tsx', 'json', 'cjs', 'mjs', 'svg'],
  assetExts: resolver.assetExts.filter(ext => ext !== 'svg'),
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
};

// ─── Watch folders for better performance ──────────────────────────
config.watchFolders = [
  path.resolve(__dirname, 'src'),
  path.resolve(__dirname, 'assets'),
];

// ─── Max workers for better performance ────────────────────────────
config.maxWorkers = 4;

// ─── Cache settings for faster reloads ─────────────────────────────
config.cacheVersion = '2.1';
config.resetCache = false;

// ─── Server settings for Fast Refresh ──────────────────────────────
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Add HMR headers for Fast Refresh
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return middleware(req, res, next);
    };
  },
};

module.exports = config;