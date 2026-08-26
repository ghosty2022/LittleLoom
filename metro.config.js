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
try {
  const svgTransformer = require.resolve('react-native-svg-transformer');
  config.transformer.babelTransformerPath = svgTransformer;
} catch (e) {
  console.warn('[metro] react-native-svg-transformer not found, SVG support disabled');
}

// ─── Source extensions ──────────────────────────────────────────────
config.resolver.sourceExts = [
  'js',
  'jsx',
  'ts',
  'tsx',
  'json',
  'cjs',
  'mjs',
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

// ─── Watch folders for better performance ──────────────────────────
config.watchFolders = [
  path.resolve(__dirname, 'src'),
];

// ─── Max workers for better performance ────────────────────────────
config.maxWorkers = 4;

module.exports = config;