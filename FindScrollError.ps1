# LittleLoom ScrollView Error Diagnostic Script
# Run this in PowerShell at your project root

Write-Host "=== LittleLoom onScroll Error Diagnostic ===" -ForegroundColor Cyan
Write-Host ""

# 1. Find ALL files that use onScroll with Animated handlers
Write-Host "STEP 1: Finding all Animated.ScrollView / Animated.FlatList / useAnimatedScrollHandler usage..." -ForegroundColor Yellow
Write-Host ""

$animatedScrollFiles = Get-ChildItem -Path "./src" -Recurse -Include "*.tsx","*.ts" | 
    Select-String -Pattern "useAnimatedScrollHandler|Animated\.ScrollView|Animated\.FlatList|Animated\.createAnimatedComponent\(ScrollView\)|Animated\.createAnimatedComponent\(FlatList\)" -List |
    Select-Object -Property Path, Filename, LineNumber, Line -Unique

Write-Host "Files using Reanimated scroll components:" -ForegroundColor Green
$animatedScrollFiles | ForEach-Object { 
    Write-Host "  $($_.Filename):$($_.LineNumber) - $($_.Line.Trim())" -ForegroundColor White
}
Write-Host ""

# 2. Find ALL files that use regular ScrollView/FlatList with onScroll
Write-Host "STEP 2: Finding regular ScrollView/FlatList with onScroll that might receive animated event objects..." -ForegroundColor Yellow
Write-Host ""

$regularScrollFiles = Get-ChildItem -Path "./src" -Recurse -Include "*.tsx","*.ts" | 
    Select-String -Pattern "<ScrollView[^>]*onScroll=|<FlatList[^>]*onScroll=" -List |
    Select-Object -Property Path, Filename, LineNumber, Line -Unique

Write-Host "Files with regular ScrollView/FlatList + onScroll:" -ForegroundColor Green
$regularScrollFiles | ForEach-Object { 
    Write-Host "  $($_.Filename):$($_.LineNumber) - $($_.Line.Trim())" -ForegroundColor White
}
Write-Host ""

# 3. Find AutoHideScrollView and AutoHideAnimatedScrollView usage
Write-Host "STEP 3: Finding AutoHideScrollView / AutoHideAnimatedScrollView usage..." -ForegroundColor Yellow
Write-Host ""

$autoHideFiles = Get-ChildItem -Path "./src" -Recurse -Include "*.tsx","*.ts" | 
    Select-String -Pattern "AutoHideScrollView|AutoHideAnimatedScrollView" -List |
    Select-Object -Property Path, Filename, LineNumber, Line -Unique

Write-Host "Files using AutoHide wrappers:" -ForegroundColor Green
$autoHideFiles | ForEach-Object { 
    Write-Host "  $($_.Filename):$($_.LineNumber) - $($_.Line.Trim())" -ForegroundColor White
}
Write-Host ""

# 4. Find useTrackedScroll usage
Write-Host "STEP 4: Finding useTrackedScroll usage..." -ForegroundColor Yellow
Write-Host ""

$trackedScrollFiles = Get-ChildItem -Path "./src" -Recurse -Include "*.tsx","*.ts" | 
    Select-String -Pattern "useTrackedScroll" -List |
    Select-Object -Property Path, Filename, LineNumber, Line -Unique

Write-Host "Files using useTrackedScroll:" -ForegroundColor Green
$trackedScrollFiles | ForEach-Object { 
    Write-Host "  $($_.Filename):$($_.LineNumber) - $($_.Line.Trim())" -ForegroundColor White
}
Write-Host ""

# 5. Find the actual AutoHideScrollView.tsx source to inspect
Write-Host "STEP 5: Inspecting AutoHideScrollView.tsx source..." -ForegroundColor Yellow
Write-Host ""

$autoHideSource = Get-ChildItem -Path "./src" -Recurse -Include "AutoHideScrollView.tsx","AutoHideScrollView.ts","AutoHideScrollWrappers.tsx","AutoHideScrollWrappers.ts" -ErrorAction SilentlyContinue
if ($autoHideSource) {
    Write-Host "Found AutoHide source at: $($autoHideSource.FullName)" -ForegroundColor Green
    Write-Host ""
    Write-Host "--- First 100 lines ---" -ForegroundColor Gray
    Get-Content $autoHideSource.FullName -TotalCount 100 | ForEach-Object { Write-Host $_ }
} else {
    Write-Host "AutoHideScrollView source NOT FOUND in ./src" -ForegroundColor Red
    Write-Host "Searching entire project..." -ForegroundColor Yellow
    $autoHideSource = Get-ChildItem -Path "." -Recurse -Include "AutoHideScrollView.tsx","AutoHideScrollView.ts","AutoHideScrollWrappers.tsx","AutoHideScrollWrappers.ts" -ErrorAction SilentlyContinue
    if ($autoHideSource) {
        Write-Host "Found at: $($autoHideSource.FullName)" -ForegroundColor Green
    }
}
Write-Host ""

# 6. Check for Animated.createAnimatedComponent(ScrollView) patterns
Write-Host "STEP 6: Checking for createAnimatedComponent patterns..." -ForegroundColor Yellow
Write-Host ""

$createAnimated = Get-ChildItem -Path "./src" -Recurse -Include "*.tsx","*.ts" | 
    Select-String -Pattern "createAnimatedComponent\s*\(\s*(ScrollView|FlatList|SectionList)" |
    Select-Object -Property Path, Filename, LineNumber, Line -Unique

Write-Host "Files with createAnimatedComponent(ScrollView/FlatList):" -ForegroundColor Green
$createAnimated | ForEach-Object { 
    Write-Host "  $($_.Filename):$($_.LineNumber) - $($_.Line.Trim())" -ForegroundColor White
}
Write-Host ""

# 7. MOST IMPORTANT: Find where onScroll prop is set to an object (not function)
Write-Host "STEP 7: CRITICAL - Finding potential onScroll={object} assignments..." -ForegroundColor Yellow
Write-Host ""

# Look for patterns where onScroll is assigned from a hook that returns object
$dangerPatterns = @(
    "onScroll=\{scrollHandler\}",
    "onScroll=\{trackedScroll\}",
    "onScroll=\{.*Handler\}",
    "onScroll=\{useAnimatedScrollHandler"
)

foreach ($pattern in $dangerPatterns) {
    $matches = Get-ChildItem -Path "./src" -Recurse -Include "*.tsx","*.ts" | 
        Select-String -Pattern $pattern -List |
        Select-Object -Property Path, Filename, LineNumber, Line -Unique
    
    if ($matches) {
        Write-Host "Pattern '$pattern' found in:" -ForegroundColor Red
        $matches | ForEach-Object { 
            Write-Host "  $($_.Filename):$($_.LineNumber)" -ForegroundColor White
        }
    }
}
Write-Host ""

Write-Host "=== END DIAGNOSTIC ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "MOST LIKELY CULPRITS (in order of probability):" -ForegroundColor Magenta
Write-Host "1. AutoHideScrollView.tsx - if it passes animated event object to regular ScrollView" -ForegroundColor White
Write-Host "2. Any file using <ScrollView onScroll={scrollHandler}> where scrollHandler is from useAnimatedScrollHandler" -ForegroundColor White
Write-Host "3. Any file using <FlatList onScroll={scrollHandler}> where scrollHandler is from useAnimatedScrollHandler" -ForegroundColor White
Write-Host "4. CommunityScreen.tsx if using regular FlatList instead of Animated.FlatList" -ForegroundColor White
Write-Host ""
Write-Host "TO FIX: Ensure animated scroll handlers ONLY go to Animated.ScrollView or Animated.FlatList" -ForegroundColor Green
Write-Host "        Regular ScrollView/FlatList need function callbacks, not animated event objects" -ForegroundColor Green