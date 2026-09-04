// check-packages.js
const fs = require('fs');
const { execSync } = require('child_process');

const PACKAGES = [
  // Critical - must be installed
  { name: '@stripe/stripe-react-native', version: '0.35.0' },
  { name: 'expo-media-library', version: '~57.0.4' },
  { name: 'expo-file-system', version: '~57.0.5' },
  { name: 'expo-image-picker', version: '~57.0.15' },
  { name: 'expo-image-manipulator', version: '~57.0.15' },
  { name: 'expo-notifications', version: '~57.0.16' },
  { name: 'expo-background-fetch', version: '~57.0.15' },
  { name: 'expo-task-manager', version: '~57.0.15' },
  { name: 'expo-device', version: '~57.0.1' },
  { name: 'expo-keep-awake', version: '~57.0.1' },
  
  // Recommended for future
  { name: '@sentry/react-native', version: '~7.11.0' },
  { name: 'expo-application', version: '~57.0.2' },
  { name: 'react-native-mmkv', version: '2.12.2' },
  { name: '@shopify/react-native-skia', version: '2.6.2' },
  { name: 'react-native-pager-view', version: '8.0.2' },
  { name: 'react-native-qrcode-svg', version: '^6.3.21' },
  { name: 'drizzle-orm', version: '^0.45.2' },
];

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const missing = [];

PACKAGES.forEach(pkg => {
  if (!packageJson.dependencies[pkg.name]) {
    missing.push(`${pkg.name}@${pkg.version}`);
  }
});

if (missing.length > 0) {
  console.log('📦 Missing packages detected:');
  missing.forEach(p => console.log(`  ❌ ${p}`));
  console.log('\n🔧 Installing missing packages...');
  execSync(`npm install ${missing.join(' ')}`, { stdio: 'inherit' });
  console.log('✅ All packages installed!');
} else {
  console.log('✅ All packages are installed!');
}