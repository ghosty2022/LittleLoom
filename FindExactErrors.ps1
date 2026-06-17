# Save as FindExactErrors_v2.ps1 and run: .\FindExactErrors_v2.ps1
$src = "./src"

Write-Host "=== FINDING ALL onScroll={scrollHandler} PATTERNS ===" -ForegroundColor Cyan

$filesWithHandler = Get-ChildItem -Path $src -Recurse -Include "*.tsx" | 
    Select-String "useAnimatedScrollHandler" | 
    Select-Object -ExpandProperty Filename -Unique

foreach ($file in $filesWithHandler) {
    $path = Get-ChildItem -Path $src -Recurse -Include $file | Select-Object -First 1
    if (-not $path) { continue }

    $content = Get-Content $path.FullName -Raw

    if ($content -match 'onScroll=\{scrollHandler\}') {
        Write-Host "`nFILE: $file" -ForegroundColor Cyan

        $hasScrollAlias = $content -match 'const AnimatedScrollView\s*='
        $hasFlatListAlias = $content -match 'const AnimatedFlatList\s*='
        $hasSectionListAlias = $content -match 'const AnimatedSectionList\s*='

        $lines = $content -split "`n"
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match 'onScroll=\{scrollHandler\}') {
                $lineNum = $i + 1
                Write-Host "   Line $lineNum : $($lines[$i].Trim())" -ForegroundColor Yellow

                $componentLine = ""
                for ($j = [Math]::Max(0, $i - 30); $j -lt $i; $j++) {
                    if ($lines[$j] -match '<(ScrollView|FlatList|SectionList|AutoHideScrollView|AutoHideAnimatedScrollView|Animated\.ScrollView|Animated\.FlatList|Animated\.SectionList|AnimatedScrollView|AnimatedFlatList|AnimatedSectionList)') {
                        $componentLine = $lines[$j].Trim()
                    }
                }
                if ($componentLine) {
                    if ($componentLine -match 'AutoHideScrollView' -and $componentLine -notmatch 'AutoHideAnimated') {
                        Write-Host "   ❌ WRONG: AutoHideScrollView (should be AutoHideAnimatedScrollView)" -ForegroundColor Red
                    } 
                    elseif ($componentLine -match 'ScrollView' -and $componentLine -notmatch 'Animated' -and -not ($hasScrollAlias -and $componentLine -match 'AnimatedScrollView')) {
                        Write-Host "   ❌ WRONG: Regular ScrollView (should be Animated.ScrollView)" -ForegroundColor Red
                    } 
                    elseif ($componentLine -match 'FlatList' -and $componentLine -notmatch 'Animated' -and -not ($hasFlatListAlias -and $componentLine -match 'AnimatedFlatList')) {
                        Write-Host "   ❌ WRONG: Regular FlatList (should be Animated.FlatList)" -ForegroundColor Red
                    } 
                    elseif ($componentLine -match 'SectionList' -and $componentLine -notmatch 'Animated' -and -not ($hasSectionListAlias -and $componentLine -match 'AnimatedSectionList')) {
                        Write-Host "   ❌ WRONG: Regular SectionList (should be Animated.SectionList)" -ForegroundColor Red
                    } 
                    elseif ($componentLine -match 'AutoHideAnimated') {
                        Write-Host "   ✅ CORRECT: AutoHideAnimatedScrollView/FlatList/SectionList" -ForegroundColor Green
                    } 
                    elseif ($componentLine -match 'Animated') {
                        Write-Host "   ✅ CORRECT: Animated.ScrollView/FlatList/SectionList (or alias)" -ForegroundColor Green
                    } 
                    else {
                        Write-Host "   ⚠️ CHECK: $componentLine" -ForegroundColor Magenta
                    }
                } else {
                    Write-Host "   ⚠️ Could not detect component" -ForegroundColor Magenta
                }
            }
        }
    }
}

Write-Host "`n=== FINDING RNAnimated.event / Animated.event ON SCROLL COMPONENTS ===" -ForegroundColor Cyan

Get-ChildItem -Path $src -Recurse -Include "*.tsx" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match 'onScroll=\{(RN)?Animated\.event') {
        Write-Host "`n❌ ANIMATED.EVENT FOUND: $($_.Name)" -ForegroundColor Red
        $lines = $content -split "`n"
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match 'onScroll=\{(RN)?Animated\.event') {
                Write-Host "   Line $($i+1): $($lines[$i].Trim())" -ForegroundColor Yellow
                for ($j = [Math]::Max(0, $i - 20); $j -lt $i; $j++) {
                    if ($lines[$j] -match '<(AutoHide)?(Animated)?(ScrollView|FlatList|SectionList)') {
                        $comp = $lines[$j].Trim()
                        Write-Host "   Component: $comp" -ForegroundColor Magenta
                        if ($comp -match 'AutoHideAnimated|Animated\.(ScrollView|FlatList|SectionList)') {
                            Write-Host "   ❌ CRITICAL: RN Animated.event on REANIMATED component!" -ForegroundColor Red
                            Write-Host "   FIX: Convert to useAnimatedScrollHandler + useSharedValue" -ForegroundColor Cyan
                        }
                        break
                    }
                }
            }
        }
    }
}

Write-Host "`n=== CHECKING FOR RN Animated.Value SCROLL USAGE ===" -ForegroundColor Cyan

Get-ChildItem -Path $src -Recurse -Include "*.tsx" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match 'useAnimatedScrollHandler' -and $content -match 'RNAnimated\.Value') {
        Write-Host "`n⚠️ $($_.Name) uses BOTH useAnimatedScrollHandler AND RNAnimated.Value" -ForegroundColor Yellow
        Write-Host "   This often causes crashes. Convert RNAnimated.Value to useSharedValue." -ForegroundColor DarkYellow
    }
}

Write-Host "`n=== DONE ===" -ForegroundColor Cyan