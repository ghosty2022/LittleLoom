# ============================================================================
# LittleLoom - Fix Family Screens + VaccinationScheduleScreen
# Removes dead imports, removes @/utils/alert, fixes syntax
# ============================================================================

$ErrorActionPreference = "Stop"
$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = Get-Location }

# --- Configuration ---
$FilesToFix = @(
    "src/screens/family/AddParentScreen.tsx",
    "src/screens/family/EditGuardianScreen.tsx",
    "src/screens/family/FamilyChatListScreen.tsx",
    "src/screens/family/FamilyChatScreen.tsx",
    "src/screens/family/FamilySharingScreen.tsx",
    "src/screens/tracking/VaccinationScheduleScreen.tsx"
)

# Map file paths to actual names for reporting
$FileMap = @{
    "src/screens/family/AddParentScreen.tsx" = "AddParentScreen.tsx"
    "src/screens/family/EditGuardianScreen.tsx" = "EditGuardianScreen.tsx"
    "src/screens/family/FamilyChatListScreen.tsx" = "FamilyChatListScreen.tsx"
    "src/screens/family/FamilyChatScreen.tsx" = "FamilyChatScreen.tsx"
    "src/screens/family/FamilySharingScreen.tsx" = "FamilySharingScreen.tsx"
    "src/screens/tracking/VaccinationScheduleScreen.tsx" = "VaccinationScheduleScreen.tsx"
}

# --- Verify files exist ---
$missingFiles = @()
foreach ($file in $FilesToFix) {
    $fullPath = Join-Path $scriptDir $file
    if (-not (Test-Path $fullPath)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "ERROR: The following files were not found:" -ForegroundColor Red
    foreach ($f in $missingFiles) {
        Write-Host "  - $f" -ForegroundColor Red
    }
    Write-Host "`nMake sure you're running this from your project root (LittleLoom folder)" -ForegroundColor Yellow
    exit 1
}

# --- Backup all files ---
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
Write-Host "Creating backups..." -ForegroundColor Cyan

foreach ($file in $FilesToFix) {
    $fullPath = Join-Path $scriptDir $file
    $backupPath = "$fullPath.backup_$timestamp"
    Copy-Item $fullPath $backupPath -Force
    Write-Host "  -> Backed up: $file" -ForegroundColor Gray
}

# ============================================================================
# HELPER: Fix a single file
# ============================================================================
function Fix-File {
    param(
        [string]$RelativePath,
        [string[]]$RemoveFromRNImport = @(),
        [switch]$RemoveShowAlertImport,
        [switch]$FixDoubleSemicolon
    )

    $fullPath = Join-Path $scriptDir $RelativePath
    $content = Get-Content $fullPath -Raw
    $originalContent = $content
    $changesMade = 0
    $fileName = $FileMap[$RelativePath]

    Write-Host "`n[Fixing] $fileName" -ForegroundColor Cyan

    # 1. Remove items from react-native import
    foreach ($item in $RemoveFromRNImport) {
        # Pattern: item in middle (preceded by comma, followed by comma or space)
        $pattern1 = ",\s*$item\b"
        if ($content -match $pattern1) {
            $content = $content -replace $pattern1, ""
            Write-Host "  -> Removed '$item' from react-native import (middle)" -ForegroundColor Green
            $changesMade++
            continue
        }
        # Pattern: item at start of import block
        $pattern2 = "{\s*$item,\s*"
        if ($content -match $pattern2) {
            $content = $content -replace $pattern2, "{ "
            Write-Host "  -> Removed '$item' from start of react-native import" -ForegroundColor Green
            $changesMade++
            continue
        }
        # Pattern: item at end of import block (before })
        $pattern3 = "\b$item\s*}"
        if ($content -match $pattern3) {
            $content = $content -replace $pattern3, "}"
            Write-Host "  -> Removed '$item' from end of react-native import" -ForegroundColor Green
            $changesMade++
            continue
        }
        # Pattern: item alone in import block
        $pattern4 = "{\s*$item\s*}"
        if ($content -match $pattern4) {
            # Remove the entire import line
            $linePattern = "import\s*\{\s*$item\s*\}\s*from\s*['`"]react-native['`"];\s*\r?\n"
            $content = $content -replace $linePattern, ""
            Write-Host "  -> Removed entire react-native import line (only had $item)" -ForegroundColor Green
            $changesMade++
        }
    }

    # 2. Remove showAlert import from @/utils/alert
    if ($RemoveShowAlertImport) {
        $showAlertPattern = "import\s*\{\s*showAlert\s*\}\s*from\s*['`"]@/utils/alert['`"];\s*\r?\n"
        if ($content -match $showAlertPattern) {
            $content = $content -replace $showAlertPattern, ""
            Write-Host "  -> Removed showAlert import from @/utils/alert" -ForegroundColor Green
            $changesMade++
        }
    }

    # 3. Fix double semicolons
    if ($FixDoubleSemicolon) {
        $doubleSemiPattern = ";;\s*`n"
        if ($content -match $doubleSemiPattern) {
            $content = $content -replace ";;(\s*`n)", ";$1"
            Write-Host "  -> Fixed double semicolon" -ForegroundColor Green
            $changesMade++
        }
        if ($content -match ";;") {
            $content = $content -replace ";;", ";"
            Write-Host "  -> Fixed inline double semicolons" -ForegroundColor Green
            $changesMade++
        }
    }

    # Save if changes were made
    if ($changesMade -gt 0) {
        Set-Content $fullPath $content -NoNewline -Encoding UTF8
        Write-Host "  -> Saved ($changesMade changes)" -ForegroundColor Green
    } else {
        Write-Host "  -> No changes needed" -ForegroundColor Yellow
    }
}

# ============================================================================
# FIX 1: AddParentScreen.tsx
# Dead imports: Alert, Button, Settings, StatusBar
# Uses SweetAlert component (not showAlert from utils)
# ============================================================================
Fix-File -RelativePath "src/screens/family/AddParentScreen.tsx" `
    -RemoveFromRNImport @("Alert", "Button", "Settings", "StatusBar")

# ============================================================================
# FIX 2: EditGuardianScreen.tsx
# Dead imports: Alert, Button, Share, Switch, useColorScheme
# Uses useSweetAlert hook (not showAlert from utils)
# ============================================================================
Fix-File -RelativePath "src/screens/family/EditGuardianScreen.tsx" `
    -RemoveFromRNImport @("Alert", "Button", "Share", "Switch", "useColorScheme")

# ============================================================================
# FIX 3: FamilyChatListScreen.tsx
# Dead imports: Alert, Button, Dimensions, FlatList, Image, Modal, Platform, ScrollView, Switch, TextInput
# Has showAlert import from @/utils/alert (also has its own SweetAlertChatList component)
# ============================================================================
Fix-File -RelativePath "src/screens/family/FamilyChatListScreen.tsx" `
    -RemoveFromRNImport @("Alert", "Button", "Dimensions", "FlatList", "Image", "Modal", "Platform", "ScrollView", "Switch", "TextInput") `
    -RemoveShowAlertImport

# ============================================================================
# FIX 4: FamilyChatScreen.tsx
# Dead imports: Alert, Button, Dimensions, FlatList, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, Share, Switch, TextInput
# Has showAlert import from @/utils/alert (also has its own SweetAlertChat component)
# ============================================================================
Fix-File -RelativePath "src/screens/family/FamilyChatScreen.tsx" `
    -RemoveFromRNImport @("Alert", "Button", "Dimensions", "FlatList", "Image", "KeyboardAvoidingView", "Modal", "Platform", "ScrollView", "Share", "Switch", "TextInput") `
    -RemoveShowAlertImport

# ============================================================================
# FIX 5: FamilySharingScreen.tsx
# Dead imports: Alert, Button, Dimensions, Image, Modal, Platform, RefreshControl, ScrollView, Share, Switch, TextInput
# Has showAlert import from @/utils/alert (also has useSweetAlert hook)
# ============================================================================
Fix-File -RelativePath "src/screens/family/FamilySharingScreen.tsx" `
    -RemoveFromRNImport @("Alert", "Button", "Dimensions", "Image", "Modal", "Platform", "RefreshControl", "ScrollView", "Share", "Switch", "TextInput") `
    -RemoveShowAlertImport

# ============================================================================
# FIX 6: VaccinationScheduleScreen.tsx
# Dead imports: Alert, Button, Settings
# Uses SweetAlert component (not showAlert from utils)
# ============================================================================
Fix-File -RelativePath "src/screens/tracking/VaccinationScheduleScreen.tsx" `
    -RemoveFromRNImport @("Alert", "Button", "Settings")

# ============================================================================
# SUMMARY
# ============================================================================
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  All family + vaccination fixes applied!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Files modified:" -ForegroundColor Cyan
foreach ($file in $FilesToFix) {
    Write-Host "  ✓ $file" -ForegroundColor White
}
Write-Host ""
Write-Host "Backups created with suffix: .backup_$timestamp" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Review changes in your IDE" -ForegroundColor White
Write-Host "  2. Run: npx tsc --noEmit (check TS errors)" -ForegroundColor White
Write-Host "  3. Test the app" -ForegroundColor White