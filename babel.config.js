// babel.config.js
module.exports = function (api) {
  api.cache(true);

  const plugins = [
    ['module-resolver', {
      root: ['./src'],
      alias: {
        '@': './src',
      },
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    }],
  ];

  // Only add Reanimated plugins if they're installed
  try {
    require.resolve('react-native-worklets/plugin');
    plugins.push('react-native-worklets/plugin');
  } catch (e) {
    // Worklets not installed, skip
  }

  try {
    require.resolve('react-native-reanimated/plugin');
    // Add with unique name to avoid duplication
    plugins.push(['react-native-reanimated/plugin', {}, 'reanimated-plugin']);
  } catch (e) {
    // Reanimated not installed, skip
  }

  return {
    presets: [
      ['babel-preset-expo', {
        jsxRuntime: 'automatic',
      }],
    ],
    plugins,
  };
};