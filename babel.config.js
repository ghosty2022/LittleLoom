
module.exports = function (api) {
  api.cache(true);

  const isProd = process.env.NODE_ENV === 'production';

  const plugins = [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@': './src',
          '@components': './src/components',
          '@screens': './src/screens',
          '@navigation': './src/navigation',
          '@context': './src/context',
          '@utils': './src/utils',
          '@hooks': './src/hooks',
          '@services': './src/services',
          '@assets': './assets',
          '@types': './src/types',
          '@theme': './src/theme',
          '@providers': './src/providers',
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      },
    ],
    
    [
      'react-native-reanimated/plugin',
      {
        relativeSourceLocation: true,
      },
    ],
  ];

  
  if (isProd) {
    plugins.unshift([
      'transform-remove-console',
      { exclude: ['error', 'warn'] },
    ]);
  }

  return {
    presets: [
      [
        'babel-preset-expo',
        {
          jsxRuntime: 'automatic',
        },
      ],
    ],
    plugins,
  };
};