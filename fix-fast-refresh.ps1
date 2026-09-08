# fix-fast-refresh.ps1
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🔄 LITTLELOOM - FAST REFRESH FIX" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ─── Step 1: Clear all caches ──────────────────────────────────────
Write-Host "📦 Clearing caches..." -ForegroundColor Yellow

# Clear Expo cache
if (Test-Path .expo) {
    Remove-Item -Recurse -Force .expo -ErrorAction SilentlyContinue
    Write-Host "  ✅ .expo cleared" -ForegroundColor Green
}

# Clear node_modules cache
if (Test-Path node_modules/.cache) {
    Remove-Item -Recurse -Force node_modules/.cache -ErrorAction SilentlyContinue
    Write-Host "  ✅ node_modules/.cache cleared" -ForegroundColor Green
}

# Clear general cache
if (Test-Path .cache) {
    Remove-Item -Recurse -Force .cache -ErrorAction SilentlyContinue
    Write-Host "  ✅ .cache cleared" -ForegroundColor Green
}

# Clear Metro cache
$metroCachePaths = @(
    "$env:TEMP\metro-*",
    "$env:TEMP\react-*",
    "$env:TEMP\expo-*",
    "$env:TEMP\babel-*"
)
foreach ($path in $metroCachePaths) {
    if (Test-Path $path) {
        Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue
    }
}
Write-Host "  ✅ Metro/Temp cache cleared" -ForegroundColor Green

# Clear watchman (if installed)
try {
    $watchmanCheck = Get-Command watchman -ErrorAction SilentlyContinue
    if ($watchmanCheck) {
        & watchman watch-del-all 2>$null
        Write-Host "  ✅ Watchman cache cleared" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️ Watchman not installed (skipping)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠️ Watchman not available (skipping)" -ForegroundColor Yellow
}

Write-Host "✅ All caches cleared!" -ForegroundColor Green
Write-Host ""

# ─── Step 2: Set environment variables ─────────────────────────────
Write-Host "🌐 Setting environment variables..." -ForegroundColor Yellow

$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.1.228"
$env:EXPO_USE_FAST_RESOLVER="true"
$env:EXPO_USE_METRO_WORKER="true"
$env:NODE_OPTIONS="--max-old-space-size=8192"
$env:EXPO_NO_TELEMETRY="true"
$env:BABEL_ENV="development"
$env:NODE_ENV="development"
$env:EXPO_BUNDLE_USE_FAST_RESOLVER="true"
$env:EXPO_FAST_REFRESH="true"

Write-Host "  ✅ REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.228" -ForegroundColor Gray
Write-Host "  ✅ EXPO_USE_FAST_RESOLVER=true" -ForegroundColor Gray
Write-Host "  ✅ EXPO_USE_METRO_WORKER=true" -ForegroundColor Gray
Write-Host "  ✅ NODE_OPTIONS=--max-old-space-size=8192" -ForegroundColor Gray
Write-Host "  ✅ EXPO_NO_TELEMETRY=true" -ForegroundColor Gray
Write-Host "  ✅ EXPO_FAST_REFRESH=true" -ForegroundColor Gray

Write-Host "✅ Environment variables set!" -ForegroundColor Green
Write-Host ""

# ─── Step 3: Start Expo with optimizations ──────────────────────────
Write-Host "🚀 Starting Expo with optimizations..." -ForegroundColor Yellow
Write-Host "   ═══════════════════════════════════════════════" -ForegroundColor Gray
Write-Host "   • Max workers: 4" -ForegroundColor Gray
Write-Host "   • Memory limit: 8GB" -ForegroundColor Gray
Write-Host "   • Fast resolver: enabled" -ForegroundColor Gray
Write-Host "   • Metro worker: enabled" -ForegroundColor Gray
Write-Host "   • Cache: cleared" -ForegroundColor Gray
Write-Host "   ═══════════════════════════════════════════════" -ForegroundColor Gray
Write-Host ""

Write-Host "💡 Press 'r' to reload, 'd' for developer menu" -ForegroundColor Magenta
Write-Host "💡 Press Ctrl+C to stop the server" -ForegroundColor Magenta
Write-Host ""

# Start Expo with all optimizations (NO --no-minify - not supported in Expo 57)
npx expo start --clear --dev-client --max-workers=4

Write-Host ""
Write-Host "✅ Server stopped." -ForegroundColor Cyan