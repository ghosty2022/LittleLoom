# clean-disk.ps1
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  💾 LITTLELOOM - DISK SPACE CLEANUP" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ─── Calculate starting disk space ──────────────────────────────────
function Get-FreeSpace {
    $drive = Get-WmiObject Win32_LogicalDisk -Filter "DeviceID='C:'"
    $freeGB = [math]::Round($drive.FreeSpace / 1GB, 2)
    return $freeGB
}

$startSpace = Get-FreeSpace
Write-Host "💾 Starting free space: $startSpace GB" -ForegroundColor Green
Write-Host ""

# ─── 1. Clear Node.js caches ────────────────────────────────────────
Write-Host "📦 Clearing Node.js caches..." -ForegroundColor Yellow

# npm cache
Write-Host "  • npm cache..." -ForegroundColor Gray
npm cache clean --force 2>$null

# yarn cache (if exists)
if (Get-Command yarn -ErrorAction SilentlyContinue) {
    Write-Host "  • yarn cache..." -ForegroundColor Gray
    yarn cache clean 2>$null
}

# pnpm cache (if exists)
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    Write-Host "  • pnpm cache..." -ForegroundColor Gray
    pnpm store prune 2>$null
}

# ─── 2. Clear Expo/Metro caches ─────────────────────────────────────
Write-Host "  • Expo/Metro caches..." -ForegroundColor Gray

# Project caches
Remove-Item -Recurse -Force .expo -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules/.cache -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .cache -ErrorAction SilentlyContinue

# ─── 3. Clear Temp folders ──────────────────────────────────────────
Write-Host "  • Temp folders..." -ForegroundColor Gray

$tempPaths = @(
    "$env:TEMP\metro-*",
    "$env:TEMP\react-*",
    "$env:TEMP\expo-*",
    "$env:TEMP\babel-*",
    "$env:TEMP\jest-*",
    "$env:TEMP\watchman-*",
    "$env:TEMP\*.log",
    "$env:TEMP\*.tmp",
    "$env:TEMP\npm-*",
    "$env:TEMP\yarn-*"
)

foreach ($path in $tempPaths) {
    Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue
}

# ─── 4. Clear Windows Temp ──────────────────────────────────────────
Write-Host "  • Windows temp..." -ForegroundColor Gray
Remove-Item -Recurse -Force "$env:WINDIR\Temp\*" -ErrorAction SilentlyContinue

# ─── 5. Clear user Temp ─────────────────────────────────────────────
Write-Host "  • User temp..." -ForegroundColor Gray
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Temp\*" -ErrorAction SilentlyContinue

# ─── 6. Clear npm logs ──────────────────────────────────────────────
Write-Host "  • npm logs..." -ForegroundColor Gray
Remove-Item -Recurse -Force "$env:APPDATA\npm-cache\_logs\*" -ErrorAction SilentlyContinue

# ─── 7. Clear Windows Update cache ──────────────────────────────────
Write-Host "  • Windows Update cache..." -ForegroundColor Gray
Stop-Service wuauserv -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:WINDIR\SoftwareDistribution\Download\*" -ErrorAction SilentlyContinue
Start-Service wuauserv -ErrorAction SilentlyContinue

# ─── 8. Clear Recycle Bin ────────────────────────────────────────────
Write-Host "  • Recycle Bin..." -ForegroundColor Gray
$shell = New-Object -ComObject Shell.Application
$recycleBin = $shell.Namespace(0xA)
$recycleBin.Items() | ForEach-Object { $_.Delete() }

# ─── 9. Clear Chrome browser cache ──────────────────────────────────
Write-Host "  • Browser caches..." -ForegroundColor Gray

# Chrome
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cache\*" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Code Cache\*" -ErrorAction SilentlyContinue

# Edge
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Cache\*" -ErrorAction SilentlyContinue

# ─── 10. Clear React Native caches ──────────────────────────────────
Write-Host "  • React Native caches..." -ForegroundColor Gray
Remove-Item -Recurse -Force "$env:HOMEDRIVE$env:HOMEPATH\.rncache" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:HOMEDRIVE$env:HOMEPATH\.expo" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:HOMEDRIVE$env:HOMEPATH\.npm" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:HOMEDRIVE$env:HOMEPATH\.yarn" -ErrorAction SilentlyContinue

# ─── 11. Clear Docker (if installed) ──────────────────────────────
if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "  • Docker..." -ForegroundColor Gray
    docker system prune -f 2>$null
    docker volume prune -f 2>$null
    docker image prune -f 2>$null
}

# ─── 12. Clear Android build caches ─────────────────────────────────
Write-Host "  • Android build caches..." -ForegroundColor Gray

$androidPaths = @(
    "$env:USERPROFILE\.android\cache",
    "$env:USERPROFILE\.android\build-cache",
    "$env:USERPROFILE\AppData\Local\Android\Sdk\.temp",
    "$env:USERPROFILE\AppData\Local\Android\Sdk\platform-tools\*.tmp"
)

foreach ($path in $androidPaths) {
    Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue
}

# ─── 13. Clear iOS caches (if on Mac) ──────────────────────────────
# This is for Windows only, but if you have iOS builds:
# Remove-Item -Recurse -Force "$env:USERPROFILE\Library\Developer\Xcode\DerivedData\*" -ErrorAction SilentlyContinue

# ─── 14. Clear old node_modules in projects ─────────────────────────
Write-Host "  • Old node_modules folders..." -ForegroundColor Gray

# Find and remove old node_modules folders (optional - careful!)
$searchPaths = @(
    "$env:USERPROFILE\Desktop",
    "$env:USERPROFILE\Documents",
    "$env:USERPROFILE\Downloads"
)

# Only search in known project directories
Get-ChildItem -Path "$env:USERPROFILE\Desktop" -Recurse -Directory -Filter "node_modules" -ErrorAction SilentlyContinue | 
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | 
    ForEach-Object {
        Write-Host "    Found old: $($_.FullName)" -ForegroundColor Gray
        # Uncomment to delete
        # Remove-Item -Recurse -Force $_.FullName -ErrorAction SilentlyContinue
    }

# ─── 15. Run Windows Disk Cleanup ──────────────────────────────────
Write-Host "  • Windows Disk Cleanup (DISM)..." -ForegroundColor Gray

# Clean up system files
DISM /Online /Cleanup-Image /StartComponentCleanup /ResetBase 2>$null

# Run Windows Disk Cleanup
cleanmgr /sagerun:1 2>$null

# ─── 16. Clear System Restore points (be careful!) ──────────────────
# This is optional - only keep latest restore point
# vssadmin delete shadows /all /quiet 2>$null

# ─── Calculate ending disk space ────────────────────────────────────
Write-Host ""
$endSpace = Get-FreeSpace
$freed = [math]::Round($endSpace - $startSpace, 2)

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ CLEANUP COMPLETE!" -ForegroundColor Green
Write-Host "   Starting space: $startSpace GB" -ForegroundColor Gray
Write-Host "   Ending space:   $endSpace GB" -ForegroundColor Gray
Write-Host "   Space freed:    $freed GB" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan

if ($freed -lt 1) {
    Write-Host ""
    Write-Host "⚠️ No significant space freed. Check for large files manually:" -ForegroundColor Yellow
    Write-Host "   1. Check your Downloads folder" -ForegroundColor Gray
    Write-Host "   2. Check for large video/photo files" -ForegroundColor Gray
    Write-Host "   3. Run Windows Disk Cleanup (cleanmgr)" -ForegroundColor Gray
    Write-Host "   4. Check for hibernation file: powercfg -h off" -ForegroundColor Gray
    Write-Host "   5. Reduce System Restore space usage" -ForegroundColor Gray
}

Write-Host ""
Read-Host "Press Enter to exit"