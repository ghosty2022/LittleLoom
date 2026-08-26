Write-Host "🔧 Complete Fix for LittleLoom" -ForegroundColor Yellow
Write-Host "================================" -ForegroundColor Yellow

# Kill all Node processes
Write-Host "🛑 Killing Node processes..." -ForegroundColor Yellow
taskkill /f /im node.exe 2>$null

# Clean everything
Write-Host "🧹 Cleaning all caches and corrupted files..." -ForegroundColor Yellow
Remove-Item -Recurse -Force .expo -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules/.cache -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules/metro -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules/@expo/metro-config -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules/@expo/metro-runtime -ErrorAction SilentlyContinue

# Reinstall core Metro dependencies
Write-Host "📦 Reinstalling Metro dependencies..." -ForegroundColor Yellow
npm install metro@0.84.5 @expo/metro-config@~57.0.13 @expo/metro-runtime@~57.0.13 --legacy-peer-deps

# Reinstall Babel preset
npm install babel-preset-expo@latest --legacy-peer-deps

# Reinstall Reanimated properly
Write-Host "🔄 Fixing Reanimated..." -ForegroundColor Yellow
npm uninstall react-native-reanimated react-native-worklets
npm install react-native-reanimated@3.16.7 --legacy-peer-deps

# Clear npm cache
Write-Host "🧹 Clearing npm cache..." -ForegroundColor Yellow
npm cache clean --force

# Start with clean state
Write-Host "🚀 Starting LittleLoom..." -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# Set environment
$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.1.228"

# Start Expo
npx expo start --clear --dev-client --max-workers 1