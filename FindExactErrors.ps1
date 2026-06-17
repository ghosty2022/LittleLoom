# Save as FindExactErrors_Fixed.ps1 and run: .\FindExactErrors_Fixed.ps1
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
        Write-Host "`nPROBLEM FILE: $file" -ForegroundColor Red

        # Check for aliases
        $hasScrollAlias = $content -match 'const AnimatedScrollView\s*='
        $hasFlatListAlias = $content -match 'const AnimatedFlatList\s*='
        $hasSectionListAlias = $content -match 'const AnimatedSectionList\s*='

        $lines = $content -split "`n"
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match 'onScroll=\{scrollHandler\}') {
                $lineNum = $i + 1
                Write-Host "   Line $lineNum : $($lines[$i].Trim())" -ForegroundColor Yellow

                $componentLine = ""
                for ($j = [Math]::Max(0, $i - 25); $j -lt $i; $j++) {
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
                    Write-Host "   ⚠️ Could not detect component (may be aliased or wrapped)" -ForegroundColor Magenta
                }
            }
        }
    }
}

Write-Host "`n=== FINDING Animated.event ON REGULAR SCROLLVIEWS ===" -ForegroundColor Cyan

Get-ChildItem -Path $src -Recurse -Include "*.tsx" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match 'onScroll=\{(RN)?Animated\.event') {
        Write-Host "`nANIMATED.EVENT FILE: $($_.Name)" -ForegroundColor Red
        $lines = $content -split "`n"
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match 'onScroll=\{(RN)?Animated\.event') {
                Write-Host "   Line $($i+1): $($lines[$i].Trim())" -ForegroundColor Yellow
            }
        }
    }
}

Write-Host "`n=== CHECKING IMPORTS ===" -ForegroundColor Cyan

foreach ($file in $filesWithHandler) {
    $path = Get-ChildItem -Path $src -Recurse -Include $file | Select-Object -First 1
    if (-not $path) { continue }

    $content = Get-Content $path.FullName -Raw

    if ($content -match 'AutoHideScrollView') {
        if (-not ($content -match 'AutoHideAnimatedScrollView')) {
            Write-Host "`n❌ IMPORTS AutoHideScrollView but NOT AutoHideAnimatedScrollView: $file" -ForegroundColor Red
        } else {
            Write-Host "✅ Imports both wrappers: $file" -ForegroundColor Green
        }
    }
}

Write-Host "`n=== DONE ===" -ForegroundColor Cyan