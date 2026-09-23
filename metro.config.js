// metro.config.js
// ─────────────────────────────────────────────────────────────────────
// Windows EMFILE fix — aggressively block node_modules subfolders that
// Metro does not need to watch, and use a single worker to keep the
// file-handle count low.
// ─────────────────────────────────────────────────────────────────────

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ─── SVG Support ──────────────────────────────────────────────────────
const { transformer, resolver } = config;

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
  // DO NOT override minifierConfig here — babel/minify defaults are fine
  // and overriding them opens extra files per worker.
};

// ─── Source extensions + aliases ──────────────────────────────────────
config.resolver = {
  ...resolver,
  sourceExts: ['js', 'jsx', 'ts', 'tsx', 'json', 'cjs', 'mjs', 'svg'],
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  unstable_enableSymlinks: false,   // ← don't follow symlinked duplicates
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

// ─── blockList: skip folders Metro should NOT watch ──────────────────
// This is the single biggest EMFILE win. Every pattern here removes
// thousands of files from Metro's watcher.
config.resolver.blockList = [
  // Metro / Expo caches
  /\.expo\/.*/,
  /\.metro\/.*/,
  /node_modules\/\.cache\/.*/,
  // Native build artifacts
  /android\/\.gradle\/.*/,
  /android\/\.cxx\/.*/,
  /android\/build\/.*/,
  /android\/app\/build\/.*/,
  /ios\/Pods\/.*/,
  /ios\/build\/.*/,
  /ios\/\.xcode\.env\/.*/,
  // Web / desktop builds
  /dist\/.*/,
  /web-build\/.*/,
  // Editor + OS junk
  /\.git\/.*/,
  /\.vscode\/.*/,
  /\.idea\/.*/,
  /\.DS_Store$/,
  // Logs
  /npm-debug\.log$/,
  /yarn-error\.log$/,
  /.*\.log$/,
  // Deep node_modules — the biggest single win.
  // Metro never needs to watch 3+ levels of node_modules.
  /node_modules\/.*\/node_modules\/.*\/node_modules\/.*/,
  // Docs + test fixtures inside node_modules (huge)
  /node_modules\/.*\/(docs|examples?|__tests__|__mocks__|test|tests|fixtures)\/.*/,
  // Sentry vendored tools (not part of the app bundle)
  /node_modules\/@sentry\/react-native\/dist\/js\/tools\/.*/,
];

// ─── watchFolders: include the entry files too ───────────────────────
// By default Metro watches everything under the project root. Listing
// explicit folders here narrows it down WITHOUT losing the entry files.
// CRITICAL: include App.tsx / index.js / app.json so Metro doesn't fall
// back to crawling node_modules to find them.
config.watchFolders = [
  path.resolve(__dirname, 'src'),
  path.resolve(__dirname, 'assets'),
  path.resolve(__dirname, 'App.tsx'),
  path.resolve(__dirname, 'App.js'),
  path.resolve(__dirname, 'index.js'),
  path.resolve(__dirname, 'index.tsx'),
  path.resolve(__dirname, 'app.json'),
  path.resolve(__dirname, 'package.json'),
].filter((p) => {
  try {
    return require('fs').existsSync(p);
  } catch {
    return false;
  }
});

// ─── maxWorkers = 1: fewer workers = fewer file handles ─────────────
// You can bump this to 2 later if you need more speed and EMFILE is gone.
config.maxWorkers = 1;

// ─── Watcher health check (helps detect stalls) ─────────────────────
config.watcher = {
  ...config.watcher,
  additionalExts: ['cjs', 'mjs'],
  healthCheck: {
    enabled: true,
    interval: 30000,
    timeout: 10000,
  },
};

// ─── Drop the custom enhanceMiddleware ──────────────────────────────
// The one in your current file adds no value and holds extra handles
// per request. Use the default middleware instead.
// (If you need CORS, add it at the app level, not in Metro.)

module.exports = config;