# Save as FindAllScrollIssues.ps1 and run: .\FindAllScrollIssues.ps1
# This script finds ALL onScroll-related issues in your React Native codebase
# WITHOUT fixing them — just reports so you can review

$src = "./src"
$issues = @()

function Add-Issue($file, $line, $type, $message, $severity) {
    $script:issues += [PSCustomObject]@{
        File = $file
        Line = $line
        Type = $type
        Message = $message
        Severity = $severity
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SCROLL DIAGNOSTIC REPORT" -ForegroundColor Cyan
Write-Host "  Finding all onScroll issues..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# =============================================================================
# CHECK 1: Regular function passed to Animated.ScrollView / Animated.FlatList / Animated.SectionList
# =============================================================================
Write-Host "[CHECK 1] Regular functions on Reanimated scroll components..." -ForegroundColor Yellow

Get-ChildItem -Path $src -Recurse -Include "*.tsx" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $lines = $content -split "`n"

    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]

        # Match onScroll={something} on Animated.ScrollView, Animated.FlatList, Animated.SectionList
        if ($line -match 'onScroll\s*=\s*\{([^}]+)\}') {
            $handlerName = $matches[1].Trim()

            # Look backwards to find the component name
            $component = ""
            for ($j = [Math]::Max(0, $i - 15); $j -lt $i; $j++) {
                if ($lines[$j] -match '<(Animated\.ScrollView|Animated\.FlatList|Animated\.SectionList|AutoHideAnimatedScrollView|AutoHideAnimatedFlatList|AutoHideAnimatedSectionList)[^>]*>') {
                    $component = $matches[1].Trim()
                    break
                }
            }

            if ($component -match 'Animated\.') {
                # Check if handler is useAnimatedScrollHandler
                $isUseAnimatedScrollHandler = $content -match [regex]::Escape($handlerName) + '\s*=\s*useAnimatedScrollHandler'
                # Check if handler is Animated.event
                $isAnimatedEvent = $content -match [regex]::Escape($handlerName) + '\s*=\s*Animated\.event'
                # Check if it's a regular useCallback/function
                $isRegularFunction = $content -match '(const|let|var)\s+' + [regex]::Escape($handlerName) + '\s*=\s*(useCallback|function\s*\()'

                if ($isRegularFunction -and -not $isUseAnimatedScrollHandler -and -not $isAnimatedEvent) {
                    Add-Issue $_.Name ($i+1) "REGULAR_FUNC_ON_ANIMATED" "onScroll={$handlerName} on $component -- handler is a regular function, not useAnimatedScrollHandler worklet" "CRITICAL"
                }
            }
        }
    }
}

# =============================================================================
# CHECK 2: Animated.event passed to ANY scroll component (regular or animated)
# =============================================================================
Write-Host "[CHECK 2] Animated.event on scroll components..." -ForegroundColor Yellow

Get-ChildItem -Path $src -Recurse -Include "*.tsx" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $lines = $content -split "`n"

    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match 'onScroll\s*=\s*\{([^}]*Animated\.event[^}]*)\}') {
            Add-Issue $_.Name ($i+1) "ANIMATED_EVENT" "onScroll uses Animated.event() -- this crashes on Reanimated components" "CRITICAL"
        }
    }
}

# =============================================================================
# CHECK 3: useAnimatedScrollHandler output passed to regular (non-animated) ScrollView/FlatList/SectionList
# =============================================================================
Write-Host "[CHECK 3] Worklet handlers on regular scroll components..." -ForegroundColor Yellow

Get-ChildItem -Path $src -Recurse -Include "*.tsx" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $lines = $content -split "`n"

    # Find all useAnimatedScrollHandler declarations
    $scrollHandlerVars = @()
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '(const|let|var)\s+(\w+)\s*=\s*useAnimatedScrollHandler') {
            $scrollHandlerVars += $matches[2]
        }
    }

    # Check if any of these are passed to regular (non-animated) scroll components
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        foreach ($var in $scrollHandlerVars) {
            if ($line -match "onScroll\s*=\s*\{$var\}") {
                # Look backwards for component
                $component = ""
                for ($j = [Math]::Max(0, $i - 15); $j -lt $i; $j++) {
                    if ($lines[$j] -match '<(ScrollView|FlatList|SectionList|AutoHideScrollView|AutoHideFlatList|AutoHideSectionList)(?!Animated)[^>]*>') {
                        $component = $matches[1].Trim()
                        break
                    }
                }
                if ($component -and $component -notmatch 'Animated') {
                    Add-Issue $_.Name ($i+1) "WORKLET_ON_REGULAR" "onScroll={$var} (useAnimatedScrollHandler) on regular $component -- worklets only work on Animated components" "CRITICAL"
                }
            }
        }
    }
}

# =============================================================================
# CHECK 4: Missing 'worklet' directive in useAnimatedScrollHandler
# =============================================================================
Write-Host "[CHECK 4] useAnimatedScrollHandler worklet directives..." -ForegroundColor Yellow

Get-ChildItem -Path $src -Recurse -Include "*.tsx" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match 'useAnimatedScrollHandler') {
        # Check if the useAnimatedScrollHandler block contains 'worklet'
        $matches = [regex]::Matches($content, 'useAnimatedScrollHandler\s*\(\s*\{[^}]+\}')
        foreach ($match in $matches) {
            $block = $match.Value
            if ($block -notmatch "'worklet'|" + '"worklet"') {
                # Find line number
                $beforeMatch = $content.Substring(0, $match.Index)
                $lineNum = ($beforeMatch -split "`n").Count
                Add-Issue $_.Name $lineNum "MISSING_WORKLET" "useAnimatedScrollHandler block missing 'worklet' directive" "WARNING"
            }
        }
    }
}

# =============================================================================
# CHECK 5: AutoHideScrollView (non-animated) receiving animated handlers
# =============================================================================
Write-Host "[CHECK 5] AutoHideScrollView (non-animated) receiving animated handlers..." -ForegroundColor Yellow

Get-ChildItem -Path $src -Recurse -Include "*.tsx" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $lines = $content -split "`n"

    # Find all useAnimatedScrollHandler vars
    $scrollHandlerVars = @()
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '(const|let|var)\s+(\w+)\s*=\s*useAnimatedScrollHandler') {
            $scrollHandlerVars += $matches[2]
        }
    }

    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        foreach ($var in $scrollHandlerVars) {
            if ($line -match "onScroll\s*=\s*\{$var\}") {
                for ($j = [Math]::Max(0, $i - 15); $j -lt $i; $j++) {
                    if ($lines[$j] -match '<(AutoHideScrollView|AutoHideFlatList|AutoHideSectionList)(?!Animated)[^>]*>') {
                        Add-Issue $_.Name ($i+1) "WORKLET_ON_AUTOHIDE" "onScroll={$var} on $($matches[1]) -- use AutoHideAnimated* variant instead" "CRITICAL"
                        break
                    }
                }
            }
        }
    }
}

# =============================================================================
# CHECK 6: ScreenWrapper receiving animated scroll handlers
# =============================================================================
Write-Host "[CHECK 6] ScreenWrapper onScroll prop analysis..." -ForegroundColor Yellow

Get-ChildItem -Path $src -Recurse -Include "*.tsx" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $lines = $content -split "`n"

    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '<ScreenWrapper[^>]*>') {
            # Check if this ScreenWrapper has onScroll prop
            $blockStart = $i
            $blockEnd = $i
            $depth = 0
            for ($j = $i; $j -lt $lines.Count; $j++) {
                $depth += ($lines[$j] -split '<').Count - ($lines[$j] -split '>').Count
                if ($depth -le 0) { $blockEnd = $j; break }
            }
            $block = ($lines[$blockStart..$blockEnd] -join "`n")
            if ($block -match 'onScroll\s*=\s*\{(\w+)\}') {
                $handlerName = $matches[1]
                $isAnimated = $content -match [regex]::Escape($handlerName) + '\s*=\s*useAnimatedScrollHandler'
                if ($isAnimated) {
                    Add-Issue $_.Name ($i+1) "SCREENWRAPPER_WORKLET" "ScreenWrapper receives onScroll={$handlerName} (useAnimatedScrollHandler) -- ScreenWrapper uses regular ScrollView internally" "CRITICAL"
                }
            }
        }
    }
}

# =============================================================================
# CHECK 7: Mixed imports (both RN Animated and Reanimated in same file)
# =============================================================================
Write-Host "[CHECK 7] Mixed Animated imports (RN + Reanimated)..." -ForegroundColor Yellow

Get-ChildItem -Path $src -Recurse -Include "*.tsx" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $hasRNAnimated = $content -match "from 'react-native'" -and ($content -match 'Animated\.(event|Value|ScrollView|FlatList|SectionList)')
    $hasReanimated = $content -match "from 'react-native-reanimated'"

    if ($hasRNAnimated -and $hasReanimated) {
        Add-Issue $_.Name 1 "MIXED_ANIMATED" "File imports both RN Animated and Reanimated -- high risk of conflicts" "WARNING"
    }
}

# =============================================================================
# CHECK 8: Animated.ScrollView/FlatList/SectionList without useAnimatedScrollHandler
# =============================================================================
Write-Host "[CHECK 8] Animated scroll components without worklet handlers..." -ForegroundColor Yellow

Get-ChildItem -Path $src -Recurse -Include "*.tsx" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match 'Animated\.(ScrollView|FlatList|SectionList)') {
        $hasWorklet = $content -match 'useAnimatedScrollHandler'
        $hasAnimatedEvent = $content -match 'Animated\.event'
        $hasRegularOnScroll = $content -match 'onScroll\s*=\s*\{(?!.*useAnimatedScrollHandler)'

        if (-not $hasWorklet -and $hasRegularOnScroll -and -not $hasAnimatedEvent) {
            Add-Issue $_.Name 1 "NO_WORKLET_ON_ANIMATED" "File uses Animated.ScrollView/FlatList/SectionList but no useAnimatedScrollHandler found" "WARNING"
        }
    }
}

# =============================================================================
# PRINT REPORT
# =============================================================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DIAGNOSTIC COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$critical = $issues | Where-Object { $_.Severity -eq 'CRITICAL' }
$warnings = $issues | Where-Object { $_.Severity -eq 'WARNING' }

if ($critical.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "NO ISSUES FOUND!" -ForegroundColor Green
    Write-Host "All onScroll props are correctly configured." -ForegroundColor Green
} else {
    if ($critical.Count -gt 0) {
        Write-Host "CRITICAL ISSUES ($($critical.Count)):" -ForegroundColor Red
        Write-Host "These will cause runtime crashes." -ForegroundColor Red
        Write-Host ""
        $critical | ForEach-Object {
            Write-Host "  X $($_.File):$($_.Line)" -ForegroundColor Red
            Write-Host "     [$($_.Type)] $($_.Message)" -ForegroundColor White
            Write-Host ""
        }
    }

    if ($warnings.Count -gt 0) {
        Write-Host "WARNINGS ($($warnings.Count)):" -ForegroundColor Yellow
        Write-Host "Review these for potential issues." -ForegroundColor Yellow
        Write-Host ""
        $warnings | ForEach-Object {
            Write-Host "  ! $($_.File):$($_.Line)" -ForegroundColor Yellow
            Write-Host "     [$($_.Type)] $($_.Message)" -ForegroundColor White
            Write-Host ""
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Total Critical: $($critical.Count)" -ForegroundColor $(if($critical.Count -gt 0){'Red'}else{'Green'})
Write-Host "Total Warnings: $($warnings.Count)" -ForegroundColor $(if($warnings.Count -gt 0){'Yellow'}else{'Green'})
Write-Host "Total Files Checked: $((Get-ChildItem -Path $src -Recurse -Include '*.tsx').Count)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Fix all CRITICAL issues first (they cause crashes)" -ForegroundColor White
Write-Host "2. Review WARNING issues for cleanup" -ForegroundColor White
Write-Host "3. Re-run this script after fixes to verify" -ForegroundColor White