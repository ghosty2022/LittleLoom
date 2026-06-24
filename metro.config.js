// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

module.exports = (async () => {
  const config = await getDefaultConfig(__dirname);

  return {
    ...config,
    
    // ─── TRANSFORMER ─────────────────────────────────────────────────
    transformer: {
      ...config.transformer,
      getTransformOptions: async () => ({
        transform: {
          experimentalImportSupport: false,
          inlineRequires: true,
        },
      }),
      // Safer minifier config — don't mangle in dev
      minifierConfig: {
        keep_classnames: true,
        keep_fnames: true,
        mangle: {
          toplevel: false,
          keep_classnames: true,
          keep_fnames: true,
        },
        output: {
          ascii_only: true,
          quote_keys: true,
          wrap_iife: true,
        },
        sourceMap: {
          includeSources: false,
        },
        toplevel: false,
        compress: {
          drop_console: false,
          keep_classnames: true,
          keep_fnames: true,
          keep_infinity: true,
          typeofs: false,
        },
      },
      assetPlugins: ['expo-asset/tools/hashAssetFiles'],
      // REMOVED: babelTransformerPath pointing to reanimated/plugin (wrong!)
      // The reanimated Babel plugin should be in babel.config.js, not here
    },

    // ─── RESOLVER ────────────────────────────────────────────────────
    resolver: {
      ...config.resolver,
      sourceExts: [...config.resolver.sourceExts, 'cjs', 'mjs', 'svg'],
      assetExts: [
        ...config.resolver.assetExts.filter(ext => ext !== 'svg'),
        'ttf',
        'otf',
        'woff',
        'woff2',
        'png',
        'jpg',
        'jpeg',
        'gif',
        'webp',
        'mp3',
        'mp4',
        'wav',
        'db',
        'sqlite',
      ],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
      disableHierarchicalLookup: false,
    },

    // ─── WATCHER ─────────────────────────────────────────────────────
    watchFolders: [path.resolve(__dirname)],

    // ─── SERVER ──────────────────────────────────────────────────────
    server: {
      ...config.server,
      enhanceMiddleware: (middleware) => {
        return (req, res, next) => {
          if (req.url.match(/\\.(ttf|otf|woff|woff2|png|jpg|jpeg|gif|webp|mp3|mp4|wav)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
          if (req.url.match(/\\.(js|ts|tsx|jsx)$/)) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
          return middleware(req, res, next);
        };
      },
    },

    // ─── SERIALIZER ──────────────────────────────────────────────────
    serializer: {
      ...config.serializer,
      getModulesRunBeforeMainModule: () => [],
      getPolyfills: () => [],
    },
  };
})();