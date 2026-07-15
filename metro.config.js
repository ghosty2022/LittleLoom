const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs', 'mjs', 'svg'];
config.resolver.assetExts = [
  ...config.resolver.assetExts.filter(ext => ext !== 'svg'),
  'ttf', 'otf', 'woff', 'woff2', 'png', 'jpg', 'jpeg', 'gif', 'webp',
  'mp3', 'mp4', 'wav', 'db', 'sqlite',
];
config.resolver.alias = {
  '@': path.resolve(__dirname, 'src'),
};

module.exports = config;