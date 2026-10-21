const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

/* ═══════════════════════════════════════════════════════════════════════════
   TRANSFORMER
   ═══════════════════════════════════════════════════════════════════════════ */

config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),

  // Faster + safer minifier config.
  // NOTE: keep_classnames / keep_fnames are only used in production bundles.
  minifierConfig: {
    keep_classnames: true,
    keep_fnames: true,
    mangle: { toplevel: false },
    compress: { reduce_funcs: false, passes: 1 },
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   RESOLVER
   ═══════════════════════════════════════════════════════════════════════════ */

const defaultSourceExts = config.resolver.sourceExts;
const defaultAssetExts = config.resolver.assetExts;

// Precompute once — avoids O(n²) Set spread churn on every resolve call.
const SOURCE_EXTS = Array.from(
  new Set([...defaultSourceExts.filter((ext) => ext !== 'svg'), 'svg', 'cjs', 'mjs'])
);

const ASSET_EXTS = Array.from(
  new Set([
    ...defaultAssetExts.filter((ext) => ext !== 'svg'),
    'pte',
    'bin',
    'onnx',
    'tflite',
    'gguf',
  ])
);

config.resolver = {
  ...config.resolver,

  sourceExts: SOURCE_EXTS,
  assetExts: ASSET_EXTS,

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

  // blockList: ignore build artifacts + heavy ML dirs so Metro never stats them.
  // Using a single RegExp (Metro requires RegExp, not array).
  blockList:
    /([\/\\](executorch-env|executorch|\.git|\.cache)[\/\\].*)|([\/\\]android[\/\\](\.cxx|build)[\/\\].*)|([\/\\]ios[\/\\](Pods|build)[\/\\].*)/,
};

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  react: path.resolve(__dirname, 'node_modules/react'),
  'react-native': path.resolve(__dirname, 'node_modules/react-native'),
};

/* ═══════════════════════════════════════════════════════════════════════════
   PERFORMANCE / STABILITY (Windows EMFILE fix)
   ═══════════════════════════════════════════════════════════════════════════ */

// Cap parallel workers. On Windows the default (CPU count) frequently triggers
// `EMFILE: too many open files`. 2 is a safe balance between speed and stability.
config.maxWorkers = 2;

// Only watch folders that actually contain source. Watching node_modules or
// the whole project root causes Metro's file watcher to hold thousands of
// handles at once.
config.watchFolders = [
  path.resolve(__dirname, 'src'),
  path.resolve(__dirname, 'assets'),
  path.resolve(__dirname, 'plugins'),
];

/* ═══════════════════════════════════════════════════════════════════════════
   CACHE / SERIALIZER
   ═══════════════════════════════════════════════════════════════════════════ */

// Speed up cold starts: skip expensive source map generation for prod bundles.
// (Dev bundles still get inline source maps from Expo's defaults.)
if (process.env.NODE_ENV === 'production') {
  config.transformer.minifierPath = 'metro-minify-terser';
  config.serializer = {
    ...config.serializer,
    getModulesRunBeforeMainModule: () => [],
  };
}

module.exports = config;