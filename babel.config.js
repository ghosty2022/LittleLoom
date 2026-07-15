module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module-resolver', {
        root: ['./src'],
        alias: {
          '@': './src',
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      }],
      // react-native-reanimated/plugin MUST BE LAST — it inserts worklet directives
      // and must run after all other transforms
      'react-native-reanimated/plugin',
    ],
  };
};