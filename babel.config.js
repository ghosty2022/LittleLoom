// babel.config.js
module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      // Enable lazy imports
      '@babel/plugin-syntax-dynamic-import',
      // Remove console logs in production (optional but recommended)
      ['transform-remove-console', { exclude: ['error', 'warn'] }],
    ],
  };
};