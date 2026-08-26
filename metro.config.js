// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ─── Source extensions ──────────────────────────────────────────────
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'cjs',
  'mjs',
  'svg',
];

// ─── Asset extensions ────────────────────────────────────────────────
config.resolver.assetExts = [
  ...config.resolver.assetExts.filter(ext => ext !== 'svg'),
];

// ─── Path alias for @/ imports ──────────────────────────────────────
config.resolver.alias = {
  '@': path.resolve(__dirname, 'src'),
};

module.exports = config;