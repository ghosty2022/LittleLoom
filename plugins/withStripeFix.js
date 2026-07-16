// plugins/withStripeFix.js
const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withStripeFix(config) {
  return withAppBuildGradle(config, (config) => {
    let buildGradle = config.modResults.contents;

    // Already applied?
    if (buildGradle.includes('stripe-force-resolution')) {
      return config;
    }

    const resolutionStrategy = `configurations.all {
    resolutionStrategy {
        // stripe-force-resolution: align all Stripe artifacts to 20.48.6
        force 'com.stripe:payments-core:20.48.6'
        force 'com.stripe:payments-model:20.48.6'
        force 'com.stripe:stripe-android:20.48.6'
        force 'com.stripe:stripe-core:20.48.6'
        force 'com.stripe:payments-ui-core:20.48.6'
        force 'com.stripe:payment-method-messaging:20.48.6'
        force 'com.stripe:financial-connections:20.48.6'
        force 'com.stripe:identity:20.48.6'
        force 'com.stripe:link:20.48.6'
        force 'com.stripe:ml-core:20.48.6'
    }
}`;

    // Insert inside the android block
    buildGradle = buildGradle.replace(
      /(android\s*\{)/,
      `$1\n    ${resolutionStrategy}`
    );

    config.modResults.contents = buildGradle;
    return config;
  });
};