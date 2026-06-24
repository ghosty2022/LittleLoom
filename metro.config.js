const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

module.exports = (async () => {
  const config = await getDefaultConfig(__dirname);

  return {
    ...config,
    transformer: {
      ...config.transformer,
      getTransformOptions: async () => ({
        transform: {
          experimentalImportSupport: false,
          inlineRequires: true,
        },
      }),
      minifierConfig: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
        mangle: {
          toplevel: true,
        },
      },
      assetPlugins: ['expo-asset/tools/hashAssetFiles'],
    },
    resolver: {
      ...config.resolver,
      sourceExts: [...config.resolver.sourceExts, 'cjs', 'mjs'],
      assetExts: [
        ...config.resolver.assetExts,
        'ttf',
        'otf',
        'woff',
        'woff2',
      ],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      ...config.server,
      enhanceMiddleware: (middleware) => {
        return (req, res, next) => {
          if (req.url.match(/\.(ttf|otf|woff|woff2|png|jpg|jpeg|gif|webp)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
          return middleware(req, res, next);
        };
      },
    },
  };
})();