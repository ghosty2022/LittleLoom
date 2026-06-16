[CmdletBinding()]
param([int]$IntervalMinutes = 10)

$projectPath = "C:\Users\ondie\Desktop\LittleLoom"

while ($true) {
    try {
        Set-Location $projectPath
        $status = git status --porcelain
        if ($status) {
            Write-Host "$(Get-Date -Format 'HH:mm:ss') Committing changes..." -ForegroundColor Cyan
            git add -A
            $commitResult = git commit -m "auto: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" 2>$null
            if ($LASTEXITCODE -eq 0) {
                $pushResult = git push origin main 2>$null
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "$(Get-Date -Format 'HH:mm:ss') ✅ Pushed successfully" -ForegroundColor Green
                } else {
                    Write-Host "$(Get-Date -Format 'HH:mm:ss') ❌ Push failed" -ForegroundColor Red
                }
            } else {
                Write-Host "$(Get-Date -Format 'HH:mm:ss') ❌ Commit failed" -ForegroundColor Red
            }
        } else {
            Write-Host "$(Get-Date -Format 'HH:mm:ss') No changes to push" -ForegroundColor DarkGray
        }
    } catch {
        Write-Host "$(Get-Date -Format 'HH:mm:ss') ❌ Error: $_" -ForegroundColor Red
    }
    Start-Sleep -Seconds ($IntervalMinutes * 60)
}
