# setup-eas-build.ps1
# Run from: C:\Users\ondie\Desktop\LittleLoom
# Purpose: Prep the project for a clean, fast EAS build

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  LittleLoom — EAS Build Setup" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ── 0. Confirm we're in the right directory ────────────────────────
if (-not (Test-Path "package.json")) {
    Write-Host "✗ package.json not found. Run this from the LittleLoom project root." -ForegroundColor Red
    exit 1
}
Write-Host "✓ Found project root: $PWD" -ForegroundColor Green

# ── 1. Create .easignore ──────────────────────────────────────────
Write-Host ""
Write-Host "→ Creating .easignore..." -ForegroundColor Yellow

$easignoreContent = @'
# ─────────────────────────────────────────────────────────────────────
# .easignore
# Tells EAS Build which files to exclude from the upload archive.
# Smaller archive = faster compression + faster build start.
# ─────────────────────────────────────────────────────────────────────

# ─── Standard Expo / RN exclusions ─────────────────────────────────
node_modules
.expo
.expo-shared
.DS_Store
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.expo
dist
web-build
coverage
.cache
.nyc_output

# ─── Native build folders (EAS regenerates these) ──────────────────
android
ios

# ─── Local dev artifacts ───────────────────────────────────────────
*.jks
*.p8
*.p12
*.key
*.mobileprovision
*.orig.*
*.log

# ─── Python virtual environment (ExecuTorch / PyTorch) ─────────────
# CRITICAL: this folder is ~3 GB. Excluding it is the main speedup.
executorch-env/
executorch-env
**/executorch-env/**
**/executorch-env

# ─── Any other Python venvs or caches ──────────────────────────────
venv/
.venv/
__pycache__/
*.pyc
*.pyo
.pytest_cache/

# ─── Test / debug folders ──────────────────────────────────────────
__tests__/
*.test.ts
*.test.tsx
*.spec.ts
*.spec.tsx

# ─── Documentation (comment out if you want docs in the build) ─────
# README.md
# docs/
# *.md

# ─── Local environment files (secrets should go via EAS secrets) ───
.env.local
.env.development.local
.env.test.local
.env.production.local

# ─── Editor / OS junk ──────────────────────────────────────────────
.vscode
.idea
*.swp
*.swo
Thumbs.db
Desktop.ini

# ─── Git internals (not needed in the archive) ─────────────────────
.git
.gitignore
.gitattributes
'@

Set-Content -Path ".easignore" -Value $easignoreContent -Encoding UTF8
Write-Host "✓ Wrote .easignore ($((Get-Content '.easignore' | Measure-Object -Line).Lines) lines)" -ForegroundColor Green

# ── 2. Ensure .gitignore is sane ──────────────────────────────────
Write-Host ""
Write-Host "→ Verifying .gitignore..." -ForegroundColor Yellow

$gitignoreAdditions = @(
    "executorch-env/",
    "android/",
    "ios/",
    ".easignore"
)

if (-not (Test-Path ".gitignore")) {
    New-Item -Path ".gitignore" -ItemType File | Out-Null
    Write-Host "  • Created new .gitignore"
}

$existing = Get-Content ".gitignore" -ErrorAction SilentlyContinue
$added = @()
foreach ($line in $gitignoreAdditions) {
    if ($existing -notcontains $line) {
        Add-Content -Path ".gitignore" -Value $line
        $added += $line
    }
}

if ($added.Count -gt 0) {
    Write-Host "✓ Added to .gitignore: $($added -join ', ')" -ForegroundColor Green
} else {
    Write-Host "✓ .gitignore already has all required entries" -ForegroundColor Green
}

# ── 3. Verify Git repository ──────────────────────────────────────
Write-Host ""
Write-Host "→ Checking Git repository..." -ForegroundColor Yellow

if (-not (Test-Path ".git")) {
    Write-Host "  • No git repo — initializing..." -ForegroundColor Gray
    git init | Out-Null
    Write-Host "✓ Git initialized" -ForegroundColor Green
} else {
    Write-Host "✓ Git repo already exists" -ForegroundColor Green
}

# Ensure git user is configured (required for commits)
$gitName = git config user.name 2>$null
$gitEmail = git config user.email 2>$null
if (-not $gitName) {
    git config user.name "LittleLoom Developer"
    Write-Host "  • Set git user.name" -ForegroundColor Gray
}
if (-not $gitEmail) {
    git config user.email "dev@littleloom.local"
    Write-Host "  • Set git user.email" -ForegroundColor Gray
}

# ── 4. Stage and commit (EAS prefers a clean tree) ────────────────
Write-Host ""
Write-Host "→ Committing current state..." -ForegroundColor Yellow
git add -A
$status = git status --porcelain
if ($status) {
    git commit -m "Pre-EAS-build snapshot $(Get-Date -Format 'yyyy-MM-dd HH:mm')" | Out-Null
    Write-Host "✓ Committed pending changes" -ForegroundColor Green
} else {
    Write-Host "✓ Working tree already clean" -ForegroundColor Green
}

# ── 5. Report the size of the archive EAS will upload ─────────────
Write-Host ""
Write-Host "→ Measuring project archive size..." -ForegroundColor Yellow

$totalSize = (Get-ChildItem -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
        $_.FullName -notmatch '\\node_modules\\' -and
        $_.FullName -notmatch '\\\.git\\' -and
        $_.FullName -notmatch '\\executorch-env\\' -and
        $_.FullName -notmatch '\\android\\' -and
        $_.FullName -notmatch '\\ios\\' -and
        $_.FullName -notmatch '\\\.expo\\'
    } |
    Measure-Object -Property Length -Sum).Sum

$sizeMB = [math]::Round($totalSize / 1MB, 2)
Write-Host "✓ Estimated archive size: $sizeMB MB" -ForegroundColor Green

if ($sizeMB -gt 50) {
    Write-Host "  ⚠ Over 50 MB — consider adding more entries to .easignore" -ForegroundColor Yellow
}

# ── 6. Verify the .pte model is present ──────────────────────────
Write-Host ""
Write-Host "→ Verifying AI model asset..." -ForegroundColor Yellow

$ptePath = "assets\models\baby_vision.pte"
$labelsPath = "assets\models\imagenet_labels.json"

if (Test-Path $ptePath) {
    $pteSize = [math]::Round((Get-Item $ptePath).Length / 1MB, 2)
    Write-Host "✓ baby_vision.pte found ($pteSize MB)" -ForegroundColor Green
} else {
    Write-Host "✗ baby_vision.pte NOT found at $ptePath" -ForegroundColor Red
}

if (Test-Path $labelsPath) {
    $labelsSize = [math]::Round((Get-Item $labelsPath).Length / 1KB, 2)
    Write-Host "✓ imagenet_labels.json found ($labelsSize KB)" -ForegroundColor Green
} else {
    Write-Host "✗ imagenet_labels.json NOT found at $labelsPath" -ForegroundColor Red
}

# ── 7. Verify EAS CLI is logged in ────────────────────────────────
Write-Host ""
Write-Host "→ Checking EAS CLI auth..." -ForegroundColor Yellow

$whoami = eas whoami 2>$null
if ($LASTEXITCODE -eq 0 -and $whoami) {
    Write-Host "✓ Logged in as: $whoami" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Not logged in to EAS — run 'eas login' before building" -ForegroundColor Yellow
}

# ── 8. Verify EAS project is linked ───────────────────────────────
Write-Host ""
Write-Host "→ Verifying EAS project link..." -ForegroundColor Yellow

if (Test-Path "app.json") {
    $appJson = Get-Content "app.json" -Raw | ConvertFrom-Json
    $projectId = $appJson.expo.extra.eas.projectId
    if ($projectId) {
        Write-Host "✓ Project linked: $projectId" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ No projectId in app.json — run 'eas build:configure'" -ForegroundColor Yellow
    }
}

# ── 9. Done ────────────────────────────────────────────────────────
Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. If not logged in:  eas login" -ForegroundColor Gray
Write-Host "  2. Trigger the build:" -ForegroundColor Gray
Write-Host "     eas build --platform android --profile development" -ForegroundColor Cyan
Write-Host ""
Write-Host "The compression step should now take 20–60 seconds" -ForegroundColor Gray
Write-Host "instead of several minutes." -ForegroundColor Gray
Write-Host ""