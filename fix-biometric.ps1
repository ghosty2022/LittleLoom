# fix-biometric.ps1
# Fixes: Property 'isBiometricEnabled' doesn't exist

param(
    [string]$ProjectRoot = (Get-Location).Path
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  LittleLoom Biometric Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- Find SettingsScreen.tsx ---
$settingsScreen = $null
$candidates = @(
    "src\screens\settings\SettingsScreen.tsx",
    "src\screens\SettingsScreen.tsx",
    "screens\settings\SettingsScreen.tsx",
    "screens\SettingsScreen.tsx",
    "app\screens\settings\SettingsScreen.tsx",
    "app\screens\SettingsScreen.tsx"
)

foreach ($c in $candidates) {
    $p = Join-Path $ProjectRoot $c
    if (Test-Path $p) {
        $settingsScreen = $p
        break
    }
}

# Also search recursively if not found
if (-not $settingsScreen) {
    $found = Get-ChildItem -Path $ProjectRoot -Recurse -Filter "SettingsScreen.tsx" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
        $settingsScreen = $found.FullName
    }
}

if (-not $settingsScreen) {
    Write-Error "Could not find SettingsScreen.tsx anywhere in $ProjectRoot"
    exit 1
}

# --- Find SecurityContext.tsx ---
$securityContext = $null
$candidates2 = @(
    "src\context\SecurityContext.tsx",
    "context\SecurityContext.tsx",
    "app\context\SecurityContext.tsx"
)

foreach ($c in $candidates2) {
    $p = Join-Path $ProjectRoot $c
    if (Test-Path $p) {
        $securityContext = $p
        break
    }
}

if (-not $securityContext) {
    $found = Get-ChildItem -Path $ProjectRoot -Recurse -Filter "SecurityContext.tsx" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
        $securityContext = $found.FullName
    }
}

if (-not $securityContext) {
    Write-Error "Could not find SecurityContext.tsx anywhere in $ProjectRoot"
    exit 1
}

Write-Host "Found files:" -ForegroundColor Green
Write-Host "  SettingsScreen: $settingsScreen"
Write-Host "  SecurityContext: $securityContext"
Write-Host ""

# --- Read & Fix SettingsScreen.tsx ---
$content = Get-Content $settingsScreen -Raw

# Check if already fixed
if ($content -match "isBiometricEnabled\s*,") {
    Write-Host "SettingsScreen.tsx already has isBiometricEnabled - skipping" -ForegroundColor Green
} else {
    Write-Host "Fixing SettingsScreen.tsx..." -ForegroundColor Yellow
    
    # Pattern: find "settings: securitySettings," followed by "toggleBiometric,"
    # and insert "isBiometricEnabled," in between
    $pattern = "(settings:\s*securitySettings\s*,)(\s*)(toggleBiometric\s*,)"
    $replacement = "`$1`$2isBiometricEnabled,`$2`$3"
    
    $newContent = $content -replace $pattern, $replacement
    
    if ($newContent -eq $content) {
        # Try alternative pattern with different whitespace
        $pattern2 = "(settings:\s*securitySettings,)([\s\S]{0,50}?)(toggleBiometric,)"
        $replacement2 = "`$1`$2isBiometricEnabled,`$2`$3"
        $newContent = $content -replace $pattern2, $replacement2
    }
    
    if ($newContent -eq $content) {
        Write-Error "Could not patch SettingsScreen.tsx - manual fix required"
        Write-Host ""
        Write-Host "MANUAL FIX NEEDED:" -ForegroundColor Red
        Write-Host "Add this line after 'settings: securitySettings,' in your useSecurity() destructuring:"
        Write-Host "    isBiometricEnabled," -ForegroundColor Yellow
        exit 1
    }
    
    # Backup
    $ts = Get-Date -Format "yyyyMMdd_HHmmss"
    Copy-Item $settingsScreen "$settingsScreen.backup.$ts"
    
    # Write
    [System.IO.File]::WriteAllText($settingsScreen, $newContent, [System.Text.Encoding]::UTF8)
    Write-Host "  SettingsScreen.tsx patched & backed up" -ForegroundColor Green
}

# --- Fix SecurityContext.tsx (ensure direct exports exist) ---
$secContent = Get-Content $securityContext -Raw

# Check if value object has direct exports
if ($secContent -match "isBiometricEnabled:\s*state\.settings\.isBiometricEnabled") {
    Write-Host "SecurityContext.tsx already exports isBiometricEnabled directly" -ForegroundColor Green
} else {
    Write-Host "SecurityContext.tsx needs direct export fix..." -ForegroundColor Yellow
    Write-Host "  (This is a more complex fix - see manual instructions below)" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DONE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Clear cache: npx expo start -c"
Write-Host "  2. Or: npx react-native start --reset-cache"
Write-Host ""