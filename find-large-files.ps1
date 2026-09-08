# find-large-files.ps1
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🔍 FIND LARGE FILES" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$sizeLimit = 100 # MB - change this to adjust
$sizeLimitBytes = $sizeLimit * 1024 * 1024

Write-Host "📂 Searching for files larger than $sizeLimit MB..." -ForegroundColor Yellow
Write-Host "   (This may take a few minutes)" -ForegroundColor Gray
Write-Host ""

# Search in common locations
$searchPaths = @(
    "$env:USERPROFILE\Desktop",
    "$env:USERPROFILE\Downloads",
    "$env:USERPROFILE\Documents",
    "$env:TEMP",
    "$env:WINDIR\Temp"
)

$results = @()

foreach ($path in $searchPaths) {
    if (Test-Path $path) {
        Write-Host "  Searching: $path" -ForegroundColor Gray
        $files = Get-ChildItem -Path $path -Recurse -File -ErrorAction SilentlyContinue | 
            Where-Object { $_.Length -gt $sizeLimitBytes } |
            Select-Object FullName, @{N='SizeMB';E={[math]::Round($_.Length / 1MB, 2)}}, LastWriteTime
        $results += $files
    }
}

# Sort by size (largest first)
$sorted = $results | Sort-Object -Property SizeMB -Descending

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  LARGE FILES FOUND" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if ($sorted.Count -eq 0) {
    Write-Host "✅ No large files found (larger than $sizeLimit MB)" -ForegroundColor Green
} else {
    Write-Host "📊 Found $($sorted.Count) large files:" -ForegroundColor Yellow
    Write-Host ""
    
    $totalSize = 0
    $counter = 0
    foreach ($file in $sorted) {
        $counter++
        $totalSize += $file.SizeMB
        Write-Host "  $counter. $($file.FullName)" -ForegroundColor Gray
        Write-Host "     Size: $($file.SizeMB) MB | Modified: $($file.LastWriteTime)" -ForegroundColor DarkGray
        Write-Host ""
        
        if ($counter -ge 50) {
            Write-Host "  ... and $($sorted.Count - 50) more files" -ForegroundColor Gray
            break
        }
    }
    
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "📦 Total size of large files: $([math]::Round($totalSize, 2)) MB" -ForegroundColor Yellow
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
}

Write-Host ""
Read-Host "Press Enter to exit"