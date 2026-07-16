const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withStripeFix(config) {
  return withAppBuildGradle(config, (config) => {
    let buildGradle = config.modResults.contents;

    // Already applied?
    if (buildGradle.includes('com.stripe:stripe-android')) {
      return config;
    }

    const resolutionStrategy = `configurations.all {
    resolutionStrategy {
        force 'com.stripe:stripe-android:20.48.0'
    }
}`;

    // Insert right after the opening `android {` line
    // This ensures it goes inside the android block but before dependencies
    buildGradle = buildGradle.replace(
      /(android\s*\{)/,
      `$1\n    ${resolutionStrategy}`
    );

    config.modResults.contents = buildGradle;
    return config;
  });
};