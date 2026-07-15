const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Inline requires for faster startup
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

// Resolve .cjs, .mjs, and .svg as source files
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs', 'mjs', 'svg'];

// Asset extensions (Metro serves these as static files)
config.resolver.assetExts = [
  ...config.resolver.assetExts.filter(ext => ext !== 'svg'),
  'ttf', 'otf', 'woff', 'woff2', 'png', 'jpg', 'jpeg', 'gif', 'webp',
  'mp3', 'mp4', 'wav', 'db', 'sqlite',
];

// Path alias for @/ imports
config.resolver.alias = {
  '@': path.resolve(__dirname, 'src'),
};

module.exports = config;