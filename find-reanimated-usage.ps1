# save as migrate-reanimated-v4.ps1
# Run this script to automatically migrate all Reanimated 3.x code to 4.x

Write-Host "🚀 Starting Reanimated 3.x → 4.x Migration..." -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Create backup
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = "src_backup_$timestamp"
Write-Host "📁 Creating backup: $backupDir" -ForegroundColor Yellow
Copy-Item -Recurse src $backupDir
Write-Host "✅ Backup created" -ForegroundColor Green
Write-Host ""

# Function to fix file
function Fix-ReanimatedFile {
    param($FilePath)
    
    $content = Get-Content $FilePath -Raw -ErrorAction SilentlyContinue
    if (-not $content) { return $false }
    
    $original = $content
    $hasChanges = $false
    
    # 1. Fix imports - Add missing imports
    if ($content -match "from 'react-native-reanimated'") {
        $hasChanges = $true
        
        # Add Gesture and GestureDetector if useAnimatedGestureHandler is used
        if ($content -match "useAnimatedGestureHandler" -and $content -notmatch "Gesture,") {
            $content = $content -replace "import \{([^}]+)\} from 'react-native-reanimated'", {
                $imports = $_.Groups[1].Value
                # Remove useAnimatedGestureHandler from imports (will be handled by gesture-handler)
                $imports = $imports -replace "useAnimatedGestureHandler,?", ""
                $imports = $imports -replace ",useAnimatedGestureHandler", ""
                "import { Gesture, GestureDetector, $imports } from 'react-native-reanimated'"
            }
        }
        
        # Add ScrollView if useAnimatedScrollHandler is used
        if ($content -match "useAnimatedScrollHandler" -and $content -notmatch "ScrollView,") {
            $content = $content -replace "import \{([^}]+)\} from 'react-native-reanimated'", {
                $imports = $_.Groups[1].Value
                # Remove useAnimatedScrollHandler from imports (will be handled by gesture-handler)
                $imports = $imports -replace "useAnimatedScrollHandler,?", ""
                $imports = $imports -replace ",useAnimatedScrollHandler", ""
                "import { ScrollView, $imports } from 'react-native-reanimated'"
            }
        }
    }
    
    # 2. Fix useAnimatedGestureHandler → Gesture
    if ($content -match "useAnimatedGestureHandler\(") {
        $hasChanges = $true
        
        # Pattern to extract gesture handler config
        $pattern = 'useAnimatedGestureHandler\(\s*\{([^}]+)\}\s*\)'
        $content = $content -replace $pattern, {
            $config = $_.Groups[1].Value
            
            # Extract handlers
            $onStart = ""
            $onActive = ""
            $onEnd = ""
            
            if ($config -match "onStart:\s*\(([^)]+)\)\s*=>\s*\{([^}]+)\}") {
                $params = $_.Matches[0].Groups[1].Value
                $body = $_.Matches[0].Groups[2].Value
                $onStart = ".onStart(($params) => { `'worklet`'; $body })"
            }
            if ($config -match "onActive:\s*\(([^)]+)\)\s*=>\s*\{([^}]+)\}") {
                $params = $_.Matches[0].Groups[1].Value
                $body = $_.Matches[0].Groups[2].Value
                $onActive = ".onUpdate(($params) => { `'worklet`'; $body })"
            }
            if ($config -match "onEnd:\s*\(([^)]+)\)\s*=>\s*\{([^}]+)\}") {
                $params = $_.Matches[0].Groups[1].Value
                $body = $_.Matches[0].Groups[2].Value
                $onEnd = ".onEnd(($params) => { `'worklet`'; $body })"
            }
            
            "Gesture.Pan()$onStart$onActive$onEnd"
        }
        
        # Add GestureDetector wrapper
        $content = $content -replace '(\w+)\s*=\s*Gesture\.Pan\(\)', 'const $1 = Gesture.Pan()'
        $content = $content -replace '(\w+)\s*=\s*Gesture\.Native\(\)', 'const $1 = Gesture.Native()'
    }
    
    # 3. Fix useAnimatedScrollHandler → Gesture.Native
    if ($content -match "useAnimatedScrollHandler\(") {
        $hasChanges = $true
        
        $pattern = 'useAnimatedScrollHandler\(\s*\{([^}]+)\}\s*\)'
        $content = $content -replace $pattern, {
            $config = $_.Groups[1].Value
            
            $onScroll = ""
            if ($config -match "onScroll:\s*\(([^)]+)\)\s*=>\s*\{([^}]+)\}") {
                $params = $_.Matches[0].Groups[1].Value
                $body = $_.Matches[0].Groups[2].Value
                $onScroll = ".onEvent(($params) => { `'worklet`'; $body })"
            }
            
            "Gesture.Native()$onScroll"
        }
    }
    
    # 4. Fix withTiming configuration
    if ($content -match "withTiming\(") {
        $hasChanges = $true
        # Fix: withTiming(value, { duration: 300 }) remains the same
        # But ensure proper format
        $content = $content -replace 'withTiming\(\s*([^,]+),\s*{\s*duration:\s*(\d+)\s*}\s*\)', 'withTiming($1, { duration: $2 })'
        $content = $content -replace 'withTiming\(\s*([^,]+),\s*{\s*damping:\s*(\d+)\s*,\s*duration:\s*(\d+)\s*}\s*\)', 'withTiming($1, { damping: $2, duration: $3 })'
    }
    
    # 5. Fix withSpring configuration
    if ($content -match "withSpring\(") {
        $hasChanges = $true
        $content = $content -replace 'withSpring\(\s*([^,]+),\s*{\s*mass:\s*(\d+)\s*,\s*damping:\s*(\d+)\s*,\s*stiffness:\s*(\d+)\s*}\s*\)', 'withSpring($1, { mass: $2, damping: $3, stiffness: $4 })'
        $content = $content -replace 'withSpring\(\s*([^,]+),\s*{\s*damping:\s*(\d+)\s*,\s*stiffness:\s*(\d+)\s*}\s*\)', 'withSpring($1, { damping: $2, stiffness: $3 })'
        $content = $content -replace 'withSpring\(\s*([^,]+),\s*{\s*damping:\s*(\d+)\s*}\s*\)', 'withSpring($1, { damping: $2 })'
    }
    
    # 6. Fix withSequence, withDelay, withRepeat (no changes needed but ensure proper format)
    if ($content -match "withSequence\(") {
        $hasChanges = $true
    }
    if ($content -match "withDelay\(") {
        $hasChanges = $true
    }
    if ($content -match "withRepeat\(") {
        $hasChanges = $true
    }
    
    # 7. Fix Easing import - change from 'react-native' to 'react-native-reanimated'
    if ($content -match "import\s*{\s*Easing\s*}\s*from\s*'react-native'") {
        $hasChanges = $true
        $content = $content -replace "import\s*{\s*Easing\s*}\s*from\s*'react-native'", "import { Easing } from 'react-native-reanimated'"
    }
    
    # 8. Fix useAnimatedReaction
    if ($content -match "useAnimatedReaction\(") {
        $hasChanges = $true
        # useAnimatedReaction still works in v4 but ensure proper worklet usage
        $content = $content -replace 'useAnimatedReaction\(\s*\(\s*\)\s*=>\s*\{([^}]+)\}\s*,\s*\(\s*([^)]+)\s*\)\s*=>\s*\{([^}]+)\}\s*\)', {
            $prepare = $_.Matches[0].Groups[1].Value
            $reactParams = $_.Matches[0].Groups[2].Value
            $reactBody = $_.Matches[0].Groups[3].Value
            "useAnimatedReaction(() => { `'worklet`'; $prepare }, ($reactParams) => { `'worklet`'; $reactBody })"
        }
    }
    
    # 9. Fix runOnJS - ensure proper usage (still works in v4)
    if ($content -match "runOnJS\(") {
        $hasChanges = $true
        # Ensure runOnJS has proper worklet context
        $content = $content -replace 'runOnJS\(([^)]+)\)', 'runOnJS($1)'
    }
    
    # 10. Fix AnimatedProps and AnimatedStyle types
    if ($content -match "AnimatedProps") {
        $hasChanges = $true
        $content = $content -replace "AnimatedProps<([^>]+)>", 'AnimatedProps<$1>'
        $content = $content -replace "AnimatedStyle<([^>]+)>", 'AnimatedStyle<$1>'
    }
    
    # 11. Fix createAnimatedComponent
    if ($content -match "createAnimatedComponent\(") {
        $hasChanges = $true
        # createAnimatedComponent still works in v4
        $content = $content -replace 'createAnimatedComponent\(([^)]+)\)', 'createAnimatedComponent($1)'
    }
    
    # Write changes if any
    if ($hasChanges -and $content -ne $original) {
        Set-Content -Path $FilePath -Value $content -NoNewline
        return $true
    }
    
    return $false
}

# Find all files with Reanimated imports
$files = Get-ChildItem -Path src -Include *.ts,*.tsx,*.js,*.jsx -Recurse -ErrorAction SilentlyContinue

$totalFiles = $files.Count
$fixedFiles = 0
$errorFiles = 0

Write-Host "🔍 Scanning $totalFiles files..." -ForegroundColor Yellow
Write-Host ""

foreach ($file in $files) {
    try {
        $fixed = Fix-ReanimatedFile -FilePath $file.FullName
        if ($fixed) {
            $fixedFiles++
            $relativePath = $file.FullName -replace ".*\\src\\", "src/"
            Write-Host "✅ Fixed: $relativePath" -ForegroundColor Green
        }
    }
    catch {
        $errorFiles++
        Write-Host "❌ Error in: $($file.FullName)" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "📊 Migration Summary:" -ForegroundColor Cyan
Write-Host "   Total files scanned: $totalFiles" -ForegroundColor Yellow
Write-Host "   ✅ Files fixed: $fixedFiles" -ForegroundColor Green
Write-Host "   ❌ Files with errors: $errorFiles" -ForegroundColor Red

# Generate report
$report = @"
Reanimated 4.x Migration Report
Generated: $(Get-Date)
================================

Files Fixed: $fixedFiles
Total Files: $totalFiles
Errors: $errorFiles

Files Modified:
"@

$modifiedFiles = Get-ChildItem -Path src -Include *.ts,*.tsx,*.js,*.jsx -Recurse | Where-Object {
    (Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue) -match "Gesture\.|withTiming|withSpring|useAnimated"
}

foreach ($file in $modifiedFiles) {
    $report += "`n- $($file.FullName -replace '.*\\src\\', 'src/')"
}

$report | Out-File -FilePath "reanimated-migration-report.txt"
Write-Host "📝 Detailed report saved to: reanimated-migration-report.txt" -ForegroundColor Green

Write-Host ""
Write-Host "🔧 Manual Fixes Required:" -ForegroundColor Yellow
Write-Host "1. Check files with 'useAnimatedGestureHandler' - they need GestureDetector wrapping"
Write-Host "2. Verify ScrollView usage with Gesture.Native()"
Write-Host "3. Test animations after migration"
Write-Host ""
Write-Host "⚠️  Important:" -ForegroundColor Cyan
Write-Host "   • Your backup is at: $backupDir"
Write-Host "   • Run 'npx expo start --clear' to test"
Write-Host "   • Check console for any remaining errors"
Write-Host ""
Write-Host "✅ Migration complete!" -ForegroundColor Green