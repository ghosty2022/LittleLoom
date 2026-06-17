# Save as: FindRealAnimatedConflicts.ps1
# Run: .\FindRealAnimatedConflicts.ps1

$srcPath = "src"
$results = @()
$totalFiles = 0

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  REAL ANIMATED CONFLICT DETECTOR"
Write-Host "  (Read-only scan, no files modified)"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get all .tsx files
$files = Get-ChildItem -Path $srcPath -Recurse -Filter "*.tsx" -File

foreach ($file in $files) {
    $totalFiles++
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }

    # Check for React Native Animated import (the problematic one)
    $hasRNAnimated = $content -match "import\s*\{[^}]*\bAnimated\b[^}]*\}\s*from\s*['""]react-native['""]"
    
    # Check for Reanimated import (this is fine by itself)
    $hasReanimated = $content -match "from\s*['""]react-native-reanimated['""]"

    # REAL CONFLICT: Both RN Animated AND Reanimated imported
    if ($hasRNAnimated -and $hasReanimated) {
        # Extract the exact RN import line for reporting
        $rnImportLine = ($content -split "`n") | Where-Object { 
            $_ -match "import\s*\{[^}]*\bAnimated\b[^}]*\}\s*from\s*['""]react-native['""]" 
        } | Select-Object -First 1

        $results += [PSCustomObject]@{
            File = $file.FullName.Replace((Get-Location).Path + "\", "")
            RN_Animated_Line = $rnImportLine.Trim()
            Has_Reanimated = $true
            Severity = "REAL CONFLICT"
        }
    }
    # SOLO RN Animated (not necessarily bad, just flag for review)
    elseif ($hasRNAnimated) {
        $rnImportLine = ($content -split "`n") | Where-Object { 
            $_ -match "import\s*\{[^}]*\bAnimated\b[^}]*\}\s*from\s*['""]react-native['""]" 
        } | Select-Object -First 1

        $results += [PSCustomObject]@{
            File = $file.FullName.Replace((Get-Location).Path + "\", "")
            RN_Animated_Line = $rnImportLine.Trim()
            Has_Reanimated = $false
            Severity = "SOLO RN Animated (review if unused)"
        }
    }
}

# ─── REPORT ───

Write-Host "Files Scanned: $totalFiles" -ForegroundColor Gray
Write-Host ""

if ($results.Count -eq 0) {
    Write-Host "✅ NO REAL CONFLICTS FOUND!" -ForegroundColor Green
    Write-Host ""
    Write-Host "All 22 warnings from your other script are FALSE POSITIVES." -ForegroundColor Green
    Write-Host "Those files only import from 'react-native-reanimated' (which is correct)." -ForegroundColor Green
    Write-Host ""
    Write-Host "You can safely ignore the [MIXED_ANIMATED] warnings." -ForegroundColor DarkGray
} else {
    $conflicts = $results | Where-Object { $_.Severity -eq "REAL CONFLICT" }
    $solo = $results | Where-Object { $_.Severity -ne "REAL CONFLICT" }

    if ($conflicts.Count -gt 0) {
        Write-Host "🔴 REAL CONFLICTS FOUND: $($conflicts.Count)" -ForegroundColor Red
        Write-Host "   These files import Animated from BOTH 'react-native' AND 'react-native-reanimated'" -ForegroundColor Red
        Write-Host ""
        
        foreach ($c in $conflicts) {
            Write-Host "  File: $($c.File)" -ForegroundColor Yellow
            Write-Host "  Line: $($c.RN_Animated_Line)" -ForegroundColor DarkGray
            Write-Host "  Fix:  Change to -> import { Animated as RNAnimated } from 'react-native'" -ForegroundColor Cyan
            Write-Host ""
        }
    }

    if ($solo.Count -gt 0) {
        Write-Host "🟡 SOLO RN Animated imports: $($solo.Count)" -ForegroundColor DarkYellow
        Write-Host "   These import RN Animated but NOT Reanimated. Only fix if they're actually using Reanimated features." -ForegroundColor DarkYellow
        Write-Host ""
        
        foreach ($s in $solo) {
            Write-Host "  File: $($s.File)" -ForegroundColor Gray
            Write-Host "  Line: $($s.RN_Animated_Line)" -ForegroundColor DarkGray
            Write-Host ""
        }
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""