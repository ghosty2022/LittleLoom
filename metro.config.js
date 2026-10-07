// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ─── SVG Support ──────────────────────────────────────────────────────
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),

  // Keep memory sane on Windows
  minifierConfig: {
    keep_classnames: true,
    keep_fnames: true,
    mangle: { toplevel: false },
    compress: { reduce_funcs: false, passes: 1 },
  },
};

// ─── Source extensions ──────────────────────────────────────────────
config.resolver = {
  ...config.resolver,

  sourceExts: [
    'js', 'jsx', 'ts', 'tsx', 'json', 'cjs', 'mjs', 'svg',
  ],

  // `pte` is a BINARY ASSET, not a source file.
  assetExts: [
    ...config.resolver.assetExts.filter((ext) => ext !== 'svg'),
    'pte',
    'bin',
    'onnx',
    'tflite',
    'gguf',
  ],

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
    /[\/\\]\.git[\/\\].*/,
    /[\/\\]android[\/\\]\.cxx[\/\\].*/,
    /[\/\\]android[\/\\]build[\/\\].*/,
    /[\/\\]ios[\/\\]Pods[\/\\].*/,
    /[\/\\]ios[\/\\]build[\/\\].*/,
    // Block AI model caches that sometimes get created
    /[\/\\]\.cache[\/\\].*/,
    /[\/\\]executorch[\/\\].*/,
  ],
};

// ─── CRITICAL: Force single-instance of react/react-native ──────────
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  react: path.resolve(__dirname, 'node_modules/react'),
  'react-native': path.resolve(__dirname, 'node_modules/react-native'),
};

// ─── Reduce Metro worker memory pressure on Windows ─────────────────
config.maxWorkers = 2;

// ─── Speed up: don't watch these folders ────────────────────────────
config.watchFolders = [
  path.resolve(__dirname, 'src'),
  path.resolve(__dirname, 'assets'),
  path.resolve(__dirname, 'plugins'),
];

module.exports = config;