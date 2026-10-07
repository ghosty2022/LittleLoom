[CmdletBinding()]
param(
    [int]$IntervalMinutes = 10,
    [string]$ProjectPath  = "C:\Users\ondie\Desktop\LittleLoom",
    [string]$Branch       = "main",
    [switch]$NoPush,
    [switch]$Once
)

# ────────────────────────────────────────────────────────────────
#  Auto-Commit + Line Counter for LittleLoom
# ────────────────────────────────────────────────────────────────

$ErrorActionPreference = 'Continue'
Set-Location $ProjectPath

# -------- Config: which files count as "code" -------------------
$CodeExtensions = @(
    '.ts','.tsx','.js','.jsx','.mjs','.cjs',
    '.json','.css','.scss','.html','.md',
    '.sql','.py','.yml','.yaml'
)
$SkipDirs = @(
    'node_modules','.git','android','ios','.expo',
    'build','dist','.cache','coverage','.next',
    'vendor','Pods','.gradle','.idea','.vscode'
)

# -------- Helpers -----------------------------------------------
function Get-CodeStats {
    param([string]$Root)

    $stats = [ordered]@{
        Files    = 0
        Lines    = 0
        Bytes    = 0
        Blank    = 0
        Code     = 0
        Comment  = 0
        ByExt    = @{}
    }

    $extSet = [System.Collections.Generic.HashSet[string]]::new(
        [string[]]$CodeExtensions,
        [System.StringComparer]::OrdinalIgnoreCase
    )

    Get-ChildItem -Path $Root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
        $p = $_.FullName
        if ($SkipDirs | Where-Object { $p -match "[\\/]$_\b" }) { return $false }
        $extSet.Contains($_.Extension)
    } |
    ForEach-Object {
        $file = $_
        $stats.Files++
        $stats.Bytes += $file.Length

        try {
            $content = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction Stop
        } catch { return }

        if ($null -eq $content) { return }
        $lines = $content -split "`r?`n", -1

        # last element after split can be empty if file ends with newline
        if ($lines.Length -gt 0 -and $lines[-1] -eq '') {
            $lines = $lines[0..($lines.Length - 2)]
        }

        $fileLines = $lines.Length
        $stats.Lines += $fileLines

        $blank = 0; $comment = 0
        foreach ($l in $lines) {
            $t = $l.Trim()
            if ($t -eq '') { $blank++ }
            elseif ($t -match '^(//|/\*|\*|#)') { $comment++ }
        }
        $stats.Blank   += $blank
        $stats.Comment += $comment

        $ext = if ($file.Extension) { $file.Extension.ToLower() } else { '(none)' }
        if (-not $stats.ByExt.ContainsKey($ext)) {
            $stats.ByExt[$ext] = [pscustomobject]@{ Files = 0; Lines = 0 }
        }
        $stats.ByExt[$ext].Files++
        $stats.ByExt[$ext].Lines += $fileLines
    }

    $stats.Code = $stats.Lines - $stats.Blank - $stats.Comment
    return $stats
}

function Format-Bytes {
    param([long]$Bytes)
    $u = 'B','KB','MB','GB'
    $i = 0; $v = [double]$Bytes
    while ($v -ge 1024 -and $i -lt $u.Length - 1) { $v /= 1024; $i++ }
    return ('{0:N2} {1}' -f $v, $u[$i])
}

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host ("═" * 62) -ForegroundColor DarkGray
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host ("═" * 62) -ForegroundColor DarkGray
}

function Show-CodeStats {
    param($Stats, [string]$PrevLineCount, [long]$PrevBytes)

    $lineDelta = if ($PrevLineCount) { $Stats.Lines - [int]$PrevLineCount } else { 0 }
    $byteDelta = if ($PrevBytes)     { $Stats.Bytes - $PrevBytes }           else { 0 }

    $lineDeltaStr = if ($lineDelta -gt 0) { " (+$lineDelta)" }
                    elseif ($lineDelta -lt 0) { " ($lineDelta)" }
                    else { "" }
    $lineColor = if ($lineDelta -gt 0) { 'Yellow' }
                 elseif ($lineDelta -lt 0) { 'DarkYellow' }
                 else { 'White' }

    Write-Host ""
    Write-Host "  📊 CODEBASE" -ForegroundColor Cyan
    Write-Host ("  ├─ Total lines : {0:N0}{1}" -f $Stats.Lines, $lineDeltaStr) -ForegroundColor $lineColor
    Write-Host ("  ├─ Code lines  : {0:N0}" -f $Stats.Code)    -ForegroundColor Green
    Write-Host ("  ├─ Comments    : {0:N0}" -f $Stats.Comment) -ForegroundColor DarkGreen
    Write-Host ("  ├─ Blank lines : {0:N0}" -f $Stats.Blank)   -ForegroundColor DarkGray
    Write-Host ("  ├─ Files       : {0:N0}" -f $Stats.Files)   -ForegroundColor White
    Write-Host ("  └─ Size        : {0}"    -f (Format-Bytes $Stats.Bytes)) -ForegroundColor White

    # Top 5 extensions
    $top = $Stats.ByExt.GetEnumerator() |
           Sort-Object { $_.Value.Lines } -Descending |
           Select-Object -First 5
    if ($top) {
        Write-Host ""
        Write-Host "  📁 TOP EXTENSIONS" -ForegroundColor Cyan
        foreach ($e in $top) {
            $bar = '█' * [Math]::Min(30, [Math]::Max(1, [int]($e.Value.Lines / [Math]::Max(1, $Stats.Lines) * 30)))
            Write-Host ("  {0,-8} {1,8:N0} lines  {2}" -f $e.Key, $e.Value.Lines, $bar) `
                -ForegroundColor DarkCyan
        }
    }
}

function Show-GitSummary {
    $status   = git status --porcelain 2>$null
    $branch   = (git rev-parse --abbrev-ref HEAD 2>$null)
    $lastMsg  = (git log -1 --pretty=format:"%s"       2>$null)
    $lastHash = (git log -1 --pretty=format:"%h"       2>$null)
    $lastWhen = (git log -1 --pretty=format:"%cr"      2>$null)

    $changed  = if ($status) { ($status | Measure-Object).Count } else { 0 }

    Write-Host ""
    Write-Host "  🌿 GIT" -ForegroundColor Cyan
    Write-Host ("  ├─ Branch      : {0}" -f $branch)  -ForegroundColor White
    Write-Host ("  ├─ Changed     : {0} file(s)" -f $changed) `
        -ForegroundColor $(if ($changed -gt 0) { 'Yellow' } else { 'DarkGray' })
    Write-Host ("  └─ Last commit : {0} {1} ({2})" -f $lastHash, $lastMsg, $lastWhen) `
        -ForegroundColor DarkGray

    return [pscustomobject]@{ Status = $status; Changed = $changed }
}

# ────────────────────────────────────────────────────────────────
#  MAIN LOOP
# ────────────────────────────────────────────────────────────────
$prevLines = $null
$prevBytes = 0
$session   = 1

Write-Header "LittleLoom Auto-Commit  ·  every $IntervalMinutes min  ·  Ctrl+C to stop"

while ($true) {
    $startTime = Get-Date
    Write-Header ("CYCLE #{0}  ·  {1}" -f $session, $startTime.ToString('yyyy-MM-dd HH:mm:ss'))

    try {
        Set-Location $ProjectPath

        # ── git status ────────────────────────────────────────
        $git = Show-GitSummary

        # ── commit + push ─────────────────────────────────────
        if ($git.Changed -gt 0) {
            Write-Host ""
            Write-Host "  ⏳ Staging and committing..." -ForegroundColor Cyan

            git add -A 2>&1 | Out-Null
            if ($LASTEXITCODE -ne 0) {
                Write-Host "  ❌ git add failed" -ForegroundColor Red
                throw "git add failed"
            }

            $msg    = "auto: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
            $result = git commit -m $msg 2>&1

            if ($LASTEXITCODE -ne 0) {
                Write-Host "  ❌ Commit failed:" -ForegroundColor Red
                Write-Host "     $result" -ForegroundColor DarkRed
            } else {
                $short = ($result | Select-Object -First 1)
                Write-Host "  ✅ Committed: $short" -ForegroundColor Green

                if (-not $NoPush) {
                    Write-Host "  ⏳ Pushing to origin/$Branch..." -ForegroundColor Cyan
                    $push = git push origin $Branch 2>&1
                    if ($LASTEXITCODE -eq 0) {
                        Write-Host "  ✅ Pushed to origin/$Branch" -ForegroundColor Green
                    } else {
                        Write-Host "  ❌ Push failed:" -ForegroundColor Red
                        Write-Host "     $push" -ForegroundColor DarkRed
                    }
                } else {
                    Write-Host "  ⏭  Push skipped (-NoPush)" -ForegroundColor DarkGray
                }
            }
        } else {
            Write-Host ""
            Write-Host "  ✓ No changes to commit" -ForegroundColor DarkGray
        }

        # ── line stats ────────────────────────────────────────
        Write-Host ""
        Write-Host "  🔢 Counting lines..." -ForegroundColor DarkCyan
        $stats = Get-CodeStats -Root $ProjectPath

        Show-CodeStats -Stats $stats -PrevLineCount $prevLines -PrevBytes $prevBytes

        $prevLines = $stats.Lines
        $prevBytes = $stats.Bytes

    } catch {
        Write-Host ""
        Write-Host "  ❌ ERROR: $_" -ForegroundColor Red
    }

    $elapsed = (Get-Date) - $startTime
    Write-Host ""
    Write-Host ("  ⏱  Cycle took {0:N1}s" -f $elapsed.TotalSeconds) -ForegroundColor DarkGray

    if ($Once) { break }

    $next = (Get-Date).AddMinutes($IntervalMinutes)
    Write-Host ("  💤 Sleeping until {0} ({1} min)..." -f $next.ToString('HH:mm:ss'), $IntervalMinutes) `
        -ForegroundColor DarkGray

    Start-Sleep -Seconds ($IntervalMinutes * 60)
    $session++
}