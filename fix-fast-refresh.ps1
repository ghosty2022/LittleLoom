#!/bin/bash
# fix-fast-refresh.sh

echo "═══════════════════════════════════════════════════════════"
echo "  🔄 LITTLELOOM - FAST REFRESH FIX"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ─── Step 1: Clear all caches ──────────────────────────────────────
echo "📦 Clearing caches..."

# Clear Expo cache
rm -rf .expo 2>/dev/null && echo "  ✅ .expo cleared"

# Clear node_modules cache
rm -rf node_modules/.cache 2>/dev/null && echo "  ✅ node_modules/.cache cleared"

# Clear general cache
rm -rf .cache 2>/dev/null && echo "  ✅ .cache cleared"

# Clear Metro cache
rm -rf /tmp/metro-* 2>/dev/null && echo "  ✅ Metro cache cleared"

# Clear watchman (if installed)
if command -v watchman &> /dev/null; then
    watchman watch-del-all 2>/dev/null
    echo "  ✅ Watchman cache cleared"
else
    echo "  ⚠️ Watchman not installed (skipping)"
fi

echo "✅ All caches cleared!"
echo ""

# ─── Step 2: Set environment variables ─────────────────────────────
echo "🌐 Setting environment variables..."

export REACT_NATIVE_PACKAGER_HOSTNAME="192.168.1.228"
export EXPO_USE_FAST_RESOLVER="true"
export EXPO_USE_METRO_WORKER="true"
export NODE_OPTIONS="--max-old-space-size=8192"
export EXPO_NO_TELEMETRY="true"
export BABEL_ENV="development"
export NODE_ENV="development"
export EXPO_BUNDLE_USE_FAST_RESOLVER="true"

echo "  ✅ REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.228"
echo "  ✅ EXPO_USE_FAST_RESOLVER=true"
echo "  ✅ EXPO_USE_METRO_WORKER=true"
echo "  ✅ NODE_OPTIONS=--max-old-space-size=8192"
echo "  ✅ EXPO_NO_TELEMETRY=true"

echo "✅ Environment variables set!"
echo ""

# ─── Step 3: Start Expo with optimizations ──────────────────────────
echo "🚀 Starting Expo with optimizations..."
echo "   ═══════════════════════════════════════════════"
echo "   • Max workers: 4"
echo "   • Memory limit: 8GB"
echo "   • Fast resolver: enabled"
echo "   • Metro worker: enabled"
echo "   • Cache: cleared"
echo "   ═══════════════════════════════════════════════"
echo ""

echo "💡 Press 'r' to reload, 'd' for developer menu"
echo "💡 Press Ctrl+C to stop the server"
echo ""

# Start Expo with all optimizations (REMOVED --no-minify)
npx expo start --clear --dev-client --max-workers=4

echo ""
echo "✅ Server stopped."