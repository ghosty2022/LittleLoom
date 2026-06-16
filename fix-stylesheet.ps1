# fix-stylesheet.ps1 - Finds and fixes missing StyleSheet imports
$files = Get-ChildItem -Path "src\" -Recurse -Include *.ts,*.tsx

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $lines = Get-Content $file.FullName
    
    # Skip if no StyleSheet usage
    if ($content -notmatch "StyleSheet") { continue }
    
    # Check if StyleSheet is imported from react-native
    $hasImport = $false
    $inRNImport = $false
    $importStartLine = -1
    $importEndLine = -1
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        
        # Detect start of react-native import block
        if ($line -match "import\s*.*from\s*['`"]react-native['`"]" -and $line -notmatch "StyleSheet") {
            # Single line import without StyleSheet
            $hasImport = $false
            break
        }
        if ($line -match "import\s*\{") {
            $inRNImport = $true
            $importStartLine = $i
        }
        if ($inRNImport -and $line -match "from\s*['`"]react-native['`"]") {
            $importEndLine = $i
            if ($content -match "import\s*\{[^}]*StyleSheet[^}]*\}\s*from\s*['`"]react-native['`"]") {
                $hasImport = $true
            }
            $inRNImport = $false
            break
        }
        if ($inRNImport -and $line -match "\}\s*from\s*['`"]react-native['`"]") {
            $importEndLine = $i
            # Check the block for StyleSheet
            $block = ($lines[$importStartLine..$importEndLine] -join "`n")
            if ($block -match "StyleSheet") {
                $hasImport = $true
            }
            $inRNImport = $false
            break
        }
    }
    
    # Also check single-line import: import { ..., StyleSheet } from 'react-native'
    if (-not $hasImport) {
        if ($content -match "import\s*\{[^}]*StyleSheet[^}]*\}\s*from\s*['`"]react-native['`"]") {
            $hasImport = $true
        }
    }
    
    if (-not $hasImport) {
        Write-Host "❌ NEEDS FIX: $($file.FullName)" -ForegroundColor Red
    }
}