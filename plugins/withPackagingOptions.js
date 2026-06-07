const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withPackagingOptions(config) {
  return withAppBuildGradle(config, (config) => {
    // Add packagingOptions to resolve duplicate native library conflicts
    const packagingBlock = `
    packagingOptions {
        pickFirst 'lib/arm64-v8a/libreactnative.so'
        pickFirst 'lib/armeabi-v7a/libreactnative.so'
        pickFirst 'lib/x86/libreactnative.so'
        pickFirst 'lib/x86_64/libreactnative.so'
    }`;

    if (!config.modResults.contents.includes('packagingOptions')) {
      // Insert inside the android { ... } block
      config.modResults.contents = config.modResults.contents.replace(
        /android\s*\{/,
        `android {${packagingBlock}`
      );
    }

    return config;
  });
};