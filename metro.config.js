// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

module.exports = (async () => {
  const config = await getDefaultConfig(__dirname);

  return {
    ...config,
    transformer: {
      ...config.transformer,
      getTransformOptions: async () => ({
        transform: {
          experimentalImportSupport: false,
          inlineRequires: true, // Critical for startup performance
        },
      }),
      minifierPath: 'metro-minify-terser',
      minifierConfig: {
        compress: {
          drop_console: true, // Remove console in production
          drop_debugger: true,
        },
        mangle: {
          toplevel: true,
        },
      },
    },
    resolver: {
      ...config.resolver,
      sourceExts: [...config.resolver.sourceExts, 'cjs'],
    },
  };
})();