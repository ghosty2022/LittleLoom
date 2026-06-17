# Save as FindOnScrollErrors.ps1 and run: .\FindOnScrollErrors.ps1
$src = "./src"

Write-Host "=== FINDING ALL onScroll PROP USAGES ===" -ForegroundColor Cyan

Get-ChildItem -Path $src -Recurse -Include "*.tsx" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $lines = $content -split "`n"
    $found = $false
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match 'onScroll\s*=') {
            if (-not $found) {
                Write-Host "`nFILE: $($_.Name)" -ForegroundColor Cyan
                $found = $true
            }
            $lineNum = $i + 1
            $line = $lines[$i].Trim()
            Write-Host "   Line $lineNum : $line" -ForegroundColor Yellow
            
            # Detect the pattern
            if ($line -match 'Animated\.event') {
                Write-Host "   ❌ CRITICAL: Animated.event passed to onScroll!" -ForegroundColor Red
                Write-Host "   This breaks Reanimated scroll components." -ForegroundColor Red
            }
            elseif ($line -match 'scrollHandler') {
                Write-Host "   ✅ Reanimated useAnimatedScrollHandler pattern" -ForegroundColor Green
            }
            elseif ($line -match 'RNAnimated') {
                Write-Host "   ❌ RN Animated pattern detected" -ForegroundColor Red
            }
            else {
                Write-Host "   ⚠️ Unknown onScroll pattern - check manually" -ForegroundColor Magenta
            }
        }
    }
}

Write-Host "`n=== CHECKING AutoHideAnimatedScrollView COMPONENT ===" -ForegroundColor Cyan

Get-ChildItem -Path $src -Recurse -Include "*.tsx" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match 'AutoHideAnimatedScrollView|AutoHideScrollView') {
        $lines = $content -split "`n"
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match 'AutoHideAnimatedScrollView|AutoHideScrollView') {
                $lineNum = $i + 1
                Write-Host "   $($_.Name) Line $lineNum : $($lines[$i].Trim())" -ForegroundColor Yellow
            }
        }
    }
}

Write-Host "`n=== CHECKING FOR Animated.event USAGE ===" -ForegroundColor Cyan

Get-ChildItem -Path $src -Recurse -Include "*.tsx" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match 'Animated\.event') {
        $lines = $content -split "`n"
        $found = $false
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match 'Animated\.event') {
                if (-not $found) {
                    Write-Host "`nFILE: $($_.Name)" -ForegroundColor Red
                    $found = $true
                }
                $lineNum = $i + 1
                Write-Host "   Line $lineNum : $($lines[$i].Trim())" -ForegroundColor Yellow
            }
        }
    }
}

Write-Host "`n=== CHECKING FOR Animated.Value CREATION ===" -ForegroundColor Cyan

Get-ChildItem -Path $src -Recurse -Include "*.tsx" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match 'new\s+Animated\.Value|Animated\.Value\(') {
        $lines = $content -split "`n"
        $found = $false
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match 'new\s+Animated\.Value|Animated\.Value\(') {
                if (-not $found) {
                    Write-Host "`nFILE: $($_.Name)" -ForegroundColor Yellow
                    $found = $true
                }
                $lineNum = $i + 1
                Write-Host "   Line $lineNum : $($lines[$i].Trim())" -ForegroundColor Magenta
            }
        }
    }
}

Write-Host "`n=== DONE ===" -ForegroundColor Cyan