# monitor-disk.ps1
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  📊 DISK SPACE MONITOR" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

function Get-DiskUsage {
    $drive = Get-WmiObject Win32_LogicalDisk -Filter "DeviceID='C:'"
    $totalGB = [math]::Round($drive.Size / 1GB, 2)
    $freeGB = [math]::Round($drive.FreeSpace / 1GB, 2)
    $usedGB = [math]::Round(($drive.Size - $drive.FreeSpace) / 1GB, 2)
    $percent = [math]::Round(($drive.Size - $drive.FreeSpace) / $drive.Size * 100, 2)
    
    return @{
        TotalGB = $totalGB
        FreeGB = $freeGB
        UsedGB = $usedGB
        Percent = $percent
    }
}

# Get initial usage
$initial = Get-DiskUsage

Write-Host "💾 CURRENT DISK STATUS:" -ForegroundColor Yellow
Write-Host "   Total:  $($initial.TotalGB) GB" -ForegroundColor Gray
Write-Host "   Used:   $($initial.UsedGB) GB" -ForegroundColor Gray
Write-Host "   Free:   $($initial.FreeGB) GB" -ForegroundColor $(if ($initial.FreeGB -lt 10) { "Red" } else { "Green" })
Write-Host "   Usage:  $($initial.Percent)%" -ForegroundColor $(if ($initial.Percent -gt 90) { "Red" } elseif ($initial.Percent -gt 80) { "Yellow" } else { "Green" })
Write-Host ""

# Check for common space hogs
Write-Host "🔍 Checking common space hogs..." -ForegroundColor Yellow
Write-Host ""

$checkPaths = @(
    @{Path = "$env:USERPROFILE\Desktop"; Label = "Desktop"},
    @{Path = "$env:USERPROFILE\Downloads"; Label = "Downloads"},
    @{Path = "$env:USERPROFILE\Documents"; Label = "Documents"},
    @{Path = "$env:USERPROFILE\AppData\Local\Temp"; Label = "Temp (AppData)"},
    @{Path = "$env:TEMP"; Label = "Temp (System)"},
    @{Path = "node_modules"; Label = "node_modules (current dir)"},
    @{Path = ".expo"; Label = ".expo cache (current dir)"}
)

foreach ($item in $checkPaths) {
    $path = $item.Path
    $label = $item.Label
    
    if (Test-Path $path) {
        $size = (Get-ChildItem -Path $path -Recurse -ErrorAction SilentlyContinue | 
            Measure-Object -Property Length -Sum).Sum
        
        if ($size -gt 0) {
            $sizeGB = [math]::Round($size / 1GB, 2)
            $sizeMB = [math]::Round($size / 1MB, 2)
            
            if ($sizeGB -ge 1) {
                $display = "$sizeGB GB"
            } else {
                $display = "$sizeMB MB"
            }
            
            Write-Host "   $label : $display" -ForegroundColor $(if ($sizeGB -gt 5) { "Red" } elseif ($sizeGB -gt 1) { "Yellow" } else { "Gray" })
        }
    }
}

Write-Host ""
Write-Host "⚠️ If space is low, consider:" -ForegroundColor Yellow
Write-Host "   1. Run: .\clean-disk.ps1" -ForegroundColor Gray
Write-Host "   2. Run: .\find-large-files.ps1" -ForegroundColor Gray
Write-Host "   3. Check Recycle Bin" -ForegroundColor Gray
Write-Host "   4. Disable hibernation: powercfg -h off" -ForegroundColor Gray
Write-Host "   5. Reduce System Restore: System Properties > System Protection" -ForegroundColor Gray
Write-Host ""

Read-Host "Press Enter to exit"