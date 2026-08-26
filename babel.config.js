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
      // THIS MUST BE THE LAST PLUGIN
      ['react-native-reanimated/plugin', {
        relativeSourceLocation: true,
      }],
    ],
  };
};