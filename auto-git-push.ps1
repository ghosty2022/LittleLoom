[CmdletBinding()]
param([int]$IntervalMinutes = 10)

$projectPath = "C:\Users\ondie\Desktop\LittleLoom"

while ($true) {
    try {
        Set-Location $projectPath
        $status = git status --porcelain
        if ($status) {
            Write-Host "$(Get-Date -Format 'HH:mm:ss') Committing $($status.Split().Count) changes..." -ForegroundColor Cyan
            git add -A
            git commit -m "auto: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
            git push origin main
            Write-Host "$(Get-Date -Format 'HH:mm:ss') Pushed" -ForegroundColor Green
        } else {
            Write-Host "$(Get-Date -Format 'HH:mm:ss') No changes" -ForegroundColor DarkGray
        }
    } catch {
        Write-Host "$(Get-Date -Format 'HH:mm:ss') Error: $_" -ForegroundColor Red
    }
    Start-Sleep -Seconds ($IntervalMinutes * 60)
}
