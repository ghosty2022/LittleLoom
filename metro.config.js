// metro.config.js
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
      minifierPath: 'metro-minify-terser',
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
      // ─── FIX: Prevent Node 22 native ESM from intercepting expo-image ──
      // Force Metro to resolve .tsx source files in node_modules
      resolveRequest: (context, moduleName, platform) => {
        // Handle expo-image specially — force Metro to compile source
        if (moduleName === 'expo-image' || moduleName.startsWith('expo-image/')) {
          const mapping = {
            'expo-image': path.join(__dirname, 'node_modules/expo-image/src/index.ts'),
            'expo-image/src/Image': path.join(__dirname, 'node_modules/expo-image/src/Image.tsx'),
            'expo-image/src/Image.types': path.join(__dirname, 'node_modules/expo-image/src/Image.types.ts'),
            'expo-image/src/ImageBackground': path.join(__dirname, 'node_modules/expo-image/src/ImageBackground.tsx'),
            'expo-image/src/ExpoImage': path.join(__dirname, 'node_modules/expo-image/src/ExpoImage.tsx'),
            'expo-image/src/ImageModule': path.join(__dirname, 'node_modules/expo-image/src/ImageModule.ts'),
            'expo-image/src/useImage': path.join(__dirname, 'node_modules/expo-image/src/useImage.ts'),
          };

          if (mapping[moduleName]) {
            return {
              filePath: mapping[moduleName],
              type: 'sourceFile',
            };
          }
        }

        // Fall back to default resolution
        return context.resolveRequest(context, moduleName, platform);
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