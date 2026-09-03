# save as find-barcode-usage.ps1
Write-Host "🔍 Searching for expo-barcode-scanner usage..." -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

$results = @()

# Search in src directory
$files = Get-ChildItem -Path src -Include *.ts,*.tsx,*.js,*.jsx -Recurse -ErrorAction SilentlyContinue

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }
    
    # Search for barcode scanner imports
    if ($content -match "expo-barcode-scanner") {
        $results += [PSCustomObject]@{
            File = $file.FullName -replace ".*\\src\\", "src/"
            Line = "Import from expo-barcode-scanner"
        }
    }
    
    # Search for BarCodeScanner usage
    if ($content -match "BarCodeScanner") {
        $results += [PSCustomObject]@{
            File = $file.FullName -replace ".*\\src\\", "src/"
            Line = "BarCodeScanner component usage"
        }
    }
    
    # Search for useBarCodeScanner
    if ($content -match "useBarCodeScanner") {
        $results += [PSCustomObject]@{
            File = $file.FullName -replace ".*\\src\\", "src/"
            Line = "useBarCodeScanner hook usage"
        }
    }
}

if ($results.Count -gt 0) {
    Write-Host "⚠️  Found code using expo-barcode-scanner:" -ForegroundColor Yellow
    Write-Host ""
    $grouped = $results | Group-Object File
    foreach ($group in $grouped) {
        Write-Host "📄 $($group.Name)" -ForegroundColor Cyan
        foreach ($item in $group.Group) {
            Write-Host "   ├─ $($item.Line)" -ForegroundColor Yellow
        }
        Write-Host ""
    }
    Write-Host "📊 Total occurrences: $($results.Count)" -ForegroundColor Yellow
} else {
    Write-Host "✅ No code using expo-barcode-scanner found!" -ForegroundColor Green
}

Write-Host ""
Write-Host "🔧 To update the code, you can:" -ForegroundColor Cyan
Write-Host "   1. Remove the imports and usage"
Write-Host "   2. Replace with expo-camera's barcode scanner"
Write-Host "   3. Use react-native-vision-camera instead"
Write-Host ""