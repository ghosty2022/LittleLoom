// babel.config.js
module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      ['babel-preset-expo', {
        jsxRuntime: 'automatic',
      }],
    ],
    plugins: [
      ['module-resolver', {
        root: ['./src'],
        alias: {
          '@': './src',
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      }],
      // react-native-reanimated/plugin MUST BE LAST
      'react-native-reanimated/plugin',
    ],
  };
};