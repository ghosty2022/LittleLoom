# LittleLoom - Bulk Fix: useCustomization null-safety
# Run this in PowerShell at your project root
# Fixes the "Property 'darkMode' doesn't exist" crash across all screens

$screenPaths = @("src\screens", "src\components", "src\hooks", "src\context")
$files = @()
foreach ($path in $screenPaths) {
    if (Test-Path $path) {
        $files += Get-ChildItem -Path $path -Recurse -Filter "*.tsx" -ErrorAction SilentlyContinue
    }
}

$fixedCount = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $original = $content
    $fileFixed = $false

    # === PATTERN 1: Unsafe destructuring with darkMode, themeColors, triggerHaptic ===
    $pattern1 = 'const\s*\{\s*darkMode:\s*isDark\s*,\s*themeColors\s*,\s*triggerHaptic\s*\}\s*=\s*useCustomization\(\)\s*;'
    if ($content -match $pattern1) {
        $replacement1 = @"const customization = useCustomization();
  const isDark = customization?.darkMode ?? false;
  const themeColors = customization?.themeColors ?? { primary: '#667eea', secondary: '#764ba2' };
  const triggerHaptic = customization?.triggerHaptic ?? (() => {});"@
        $content = $content -replace $pattern1, $replacement1
        $fileFixed = $true
        Write-Host "  [FIXED] Pattern 1 (darkMode+themeColors+triggerHaptic): $($file.Name)" -ForegroundColor Green
    }

    # === PATTERN 2: Unsafe destructuring with shouldReduceMotion (BabySelector style) ===
    $pattern2 = 'const\s*\{\s*darkMode:\s*isDark\s*,\s*themeColors\s*,\s*shouldReduceMotion\s*\}\s*=\s*useCustomization\(\)\s*;'
    if ($content -match $pattern2) {
        $replacement2 = @"const customization = useCustomization();
  const isDark = customization?.darkMode ?? false;
  const themeColors = customization?.themeColors ?? { primary: '#667eea', secondary: '#764ba2' };
  const shouldReduceMotion = customization?.shouldReduceMotion ?? false;"@
        $content = $content -replace $pattern2, $replacement2
        $fileFixed = $true
        Write-Host "  [FIXED] Pattern 2 (darkMode+themeColors+shouldReduceMotion): $($file.Name)" -ForegroundColor Green
    }

    # === PATTERN 3: Unsafe destructuring with only darkMode and themeColors ===
    $pattern3 = 'const\s*\{\s*darkMode:\s*isDark\s*,\s*themeColors\s*\}\s*=\s*useCustomization\(\)\s*;'
    if ($content -match $pattern3) {
        $replacement3 = @"const customization = useCustomization();
  const isDark = customization?.darkMode ?? false;
  const themeColors = customization?.themeColors ?? { primary: '#667eea', secondary: '#764ba2' };"@
        $content = $content -replace $pattern3, $replacement3
        $fileFixed = $true
        Write-Host "  [FIXED] Pattern 3 (darkMode+themeColors): $($file.Name)" -ForegroundColor Green
    }

    # === PATTERN 4: Clean up old "FIX:" comments above the safe pattern ===
    $pattern4 = "\s*//\s*FIX:\s*Add safe fallback for useCustomization[^\r\n]*[\r\n]+(\s*const customization = useCustomization\(\);)"
    if ($content -match $pattern4) {
        $replacement4 = '$1'
        $content = $content -replace $pattern4, $replacement4
        $fileFixed = $true
        Write-Host "  [CLEANED] Removed old FIX comment: $($file.Name)" -ForegroundColor DarkCyan
    }

    # === PATTERN 5: Direct unsafe property access ===
    $pattern5 = 'useCustomization\(\)\s*\.\s*\w+'
    if ($content -match $pattern5) {
        Write-Host "  [WARNING] Direct property access found in $($file.Name) - review manually" -ForegroundColor Yellow
    }

    if ($fileFixed -and ($content -ne $original)) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $fixedCount++
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Done! Fixed $fixedCount files." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "`nNext steps:" -ForegroundColor White
Write-Host "  1. Clear Metro bundler cache: npx expo start --clear" -ForegroundColor Gray
Write-Host "  2. Or: rm -rf node_modules/.cache && npx expo start --clear" -ForegroundColor Gray