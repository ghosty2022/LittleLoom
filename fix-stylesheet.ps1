# fix-stylesheet-v2.ps1 - Finds and fixes missing StyleSheet + react-native imports
# Run from project root: .\fix-stylesheet-v2.ps1

$files = Get-ChildItem -Path "src\" -Recurse -Include *.tsx

$fixedCount = 0
$skippedCount = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content

    # Skip if no StyleSheet usage in file
    if ($content -notmatch "StyleSheet\.create") {
        continue
    }

    # Check if StyleSheet is already imported from react-native
    $hasStyleSheetImport = $false

    # Pattern 1: Single line: import { ..., StyleSheet } from 'react-native'
    if ($content -match "import\s*\{[^}]*StyleSheet[^}]*\}\s*from\s*['`"]react-native['`"]") {
        $hasStyleSheetImport = $true
    }
    # Pattern 2: Multi-line import block with StyleSheet
    elseif ($content -match "import\s*\{[\s\S]*?StyleSheet[\s\S]*?\}\s*from\s*['`"]react-native['`"]") {
        $hasStyleSheetImport = $true
    }

    if ($hasStyleSheetImport) {
        $skippedCount++
        continue
    }

    Write-Host "🔧 FIXING: $($file.FullName)" -ForegroundColor Yellow

    # Check if there's ANY react-native import
    $hasRNImport = $content -match "from\s*['`"]react-native['`"]"

    if ($hasRNImport) {
        # Add StyleSheet to existing react-native import
        # Handle multi-line imports
        $content = $content -replace 
            "(import\s*\{[\s\S]*?)(\}\s*from\s*['`"]react-native['`"])", 
            "$1, StyleSheet$2"

        # Handle single-line imports that the above might miss
        $content = $content -replace 
            "import\s*\{([^}]*)\}\s*from\s*['`"]react-native['`"]", 
            "import {`$1, StyleSheet} from 'react-native'"
    } else {
        # No react-native import at all - add one before the first import
        $rnImport = "import { StyleSheet } from 'react-native';`n"
        $content = $rnImport + $content
    }

    # Write the fixed content back
    Set-Content -Path $file.FullName -Value $content -NoNewline
    $fixedCount++
    Write-Host "   ✅ Fixed!" -ForegroundColor Green
}

Write-Host "`n📊 Summary:" -ForegroundColor Cyan
Write-Host "   Fixed: $fixedCount files" -ForegroundColor Green
Write-Host "   Already OK: $skippedCount files" -ForegroundColor Gray
Write-Host "`n🎉 Done! Restart Metro with 'npx expo start --clear'"