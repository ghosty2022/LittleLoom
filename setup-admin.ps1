# fix-admin.ps1 - Complete Admin Fix
Write-Host "🔧 Fixing LittleLoom Admin..." -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Ensure directories exist
$directories = @(
    "admin\css",
    "admin\js",
    "admin\pages"
)

foreach ($dir in $directories) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "📁 Created $dir" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "✅ Directory structure ready" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Please copy the following files:" -ForegroundColor Yellow
Write-Host "   1. server.js (updated with login routes)" -ForegroundColor White
Write-Host "   2. admin/pages/login.html" -ForegroundColor White
Write-Host "   3. admin/js/admin.js (with session timeout)" -ForegroundColor White
Write-Host "   4. admin/dashboard.html (with custom modal)" -ForegroundColor White
Write-Host "   5. admin/css/admin.css" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Restart the server:" -ForegroundColor Yellow
Write-Host "   node server.js" -ForegroundColor White
Write-Host ""
Write-Host "🌐 Open:" -ForegroundColor Yellow
Write-Host "   http://localhost:3000/login.html" -ForegroundColor White
Write-Host ""
Write-Host "✨ Features added:" -ForegroundColor Cyan
Write-Host "   ✅ Custom logout modal (no more ugly browser confirm)" -ForegroundColor White
Write-Host "   ✅ Session timeout (30 min inactivity auto-logout)" -ForegroundColor White
Write-Host "   ✅ Fixed login page routing" -ForegroundColor White
Write-Host "   ✅ Supabase data fetching with proper error handling" -ForegroundColor White
Write-Host "   ✅ Real-time updates via Supabase Realtime" -ForegroundColor White