# fix-server.ps1 - Fix Express Server
Write-Host "🔧 Fixing Express Server..." -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# ─── 1. CLEAN UP NODE_MODULES ──────────────────────────────────
Write-Host ""
Write-Host "🧹 Cleaning up node_modules..." -ForegroundColor Yellow

# Remove node_modules and package-lock.json to start fresh
if (Test-Path "node_modules") {
    Write-Host "Removing node_modules..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
}

if (Test-Path "package-lock.json") {
    Write-Host "Removing package-lock.json..." -ForegroundColor Yellow
    Remove-Item -Force "package-lock.json" -ErrorAction SilentlyContinue
}

Write-Host "✅ Cleanup complete" -ForegroundColor Green

# ─── 2. CREATE PACKAGE.JSON ────────────────────────────────────
Write-Host ""
Write-Host "📝 Creating package.json..." -ForegroundColor Yellow

@'
{
  "name": "littleloom-admin",
  "version": "1.0.0",
  "description": "LittleLoom Admin Dashboard",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
'@ | Out-File -FilePath "package.json" -Encoding UTF8

Write-Host "✅ package.json created" -ForegroundColor Green

# ─── 3. INSTALL EXPRESS ────────────────────────────────────────
Write-Host ""
Write-Host "📦 Installing express..." -ForegroundColor Yellow
npm install express --save

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Express installed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to install express. Please run: npm install express --save" -ForegroundColor Red
}

# ─── 4. CREATE SERVER.JS ──────────────────────────────────────
Write-Host ""
Write-Host "📝 Creating server.js..." -ForegroundColor Yellow

$serverContent = @'
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files with proper MIME types
app.use('/admin', express.static(path.join(__dirname, 'admin'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
        if (path.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html');
        }
    }
}));

app.use('/admin/css', express.static(path.join(__dirname, 'admin/css')));
app.use('/admin/js', express.static(path.join(__dirname, 'admin/js')));
app.use('/admin/pages', express.static(path.join(__dirname, 'admin/pages')));

// ─── LOGIN ROUTE ──────────────────────────────────────────────
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin/pages/login.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin/pages/login.html'));
});

// ─── MAIN ROUTES ──────────────────────────────────────────────
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

app.get('/admin', (req, res) => {
    res.redirect('/admin/dashboard.html');
});

app.get('/admin/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin/dashboard.html'));
});

app.get('/admin/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin/dashboard.html'));
});

// Handle direct page navigation
app.get('/admin/pages/:page', (req, res) => {
    const pageFile = req.params.page.endsWith('.html') ? req.params.page : req.params.page + '.html';
    res.sendFile(path.join(__dirname, 'admin/pages', pageFile));
});

// Handle root page without extension
app.get('/admin/:page', (req, res) => {
    if (req.params.page === 'dashboard') {
        res.sendFile(path.join(__dirname, 'admin/dashboard.html'));
    } else {
        res.sendFile(path.join(__dirname, 'admin/pages', req.params.page + '.html'));
    }
});

// ─── CATCH-ALL ROUTE ──────────────────────────────────────────
app.get('/*', (req, res) => {
    // Don't redirect if it's a static asset
    if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        return res.status(404).send('File not found');
    }
    res.redirect('/login.html');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🚀 LittleLoom Admin Dashboard');
    console.log('🔐 Login:  http://localhost:' + PORT + '/login.html');
    console.log('📊 Dashboard: http://localhost:' + PORT + '/admin/dashboard.html');
    console.log('📁 Pages: http://localhost:' + PORT + '/admin/pages/');
    console.log('');
    console.log('⚡ Press Ctrl+C to stop');
    console.log('');
});
'@

$serverContent | Out-File -FilePath "server.js" -Encoding UTF8
Write-Host "✅ server.js created" -ForegroundColor Green

# ─── 5. ENSURE DIRECTORIES EXIST ──────────────────────────────
Write-Host ""
Write-Host "📁 Ensuring directories exist..." -ForegroundColor Yellow

$directories = @(
    "admin\css",
    "admin\js",
    "admin\pages"
)

foreach ($dir in $directories) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "✅ Created $dir" -ForegroundColor Green
    } else {
        Write-Host "✅ $dir already exists" -ForegroundColor Green
    }
}

# ─── 6. CREATE BASIC ADMIN.CSS ──────────────────────────────────
Write-Host ""
Write-Host "📝 Creating admin/css/admin.css..." -ForegroundColor Yellow

$cssContent = @'
:root {
    --primary: #6366f1;
    --primary-dark: #4f46e5;
    --primary-light: #818cf8;
    --primary-gradient: linear-gradient(135deg, #6366f1, #8b5cf6);
    --success: #22c55e;
    --warning: #f59e0b;
    --danger: #ef4444;
    --bg-primary: #f1f5f9;
    --bg-card: #ffffff;
    --bg-sidebar: #0f172a;
    --text-primary: #0f172a;
    --text-secondary: #475569;
    --text-muted: #94a3b8;
    --text-white: #ffffff;
    --border: rgba(0,0,0,0.06);
    --border-dark: rgba(255,255,255,0.06);
    --shadow: 0 1px 3px rgba(0,0,0,0.06);
    --shadow-md: 0 4px 6px rgba(0,0,0,0.07);
    --radius: 12px;
    --radius-sm: 8px;
    --transition: 0.2s ease;
    --sidebar-width: 260px;
    --header-height: 64px;
    --font: 'Inter', -apple-system, sans-serif;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: var(--font);
    background: var(--bg-primary);
    color: var(--text-primary);
    line-height: 1.6;
    min-height: 100vh;
}

::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-thumb { background: var(--primary-light); border-radius: 10px; }

.app { display: flex; min-height: 100vh; }

.sidebar {
    width: var(--sidebar-width);
    background: var(--bg-sidebar);
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    transition: transform 0.3s ease;
    overflow-y: auto;
    border-right: 1px solid var(--border-dark);
}

.sidebar-brand {
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid var(--border-dark);
    min-height: var(--header-height);
    flex-shrink: 0;
}

.brand-icon {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-sm);
    background: var(--primary-gradient);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
}

.logo-title {
    font-weight: 800;
    font-size: 18px;
    color: var(--text-white);
}

.logo-sub {
    font-weight: 400;
    color: rgba(255,255,255,0.4);
    font-size: 11px;
    display: block;
}

.sidebar-nav {
    flex: 1;
    padding: 12px;
    overflow-y: auto;
}

.sidebar-nav-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: rgba(255,255,255,0.25);
    padding: 12px 12px 6px;
}

.sidebar-nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 14px;
    border-radius: var(--radius-sm);
    color: rgba(255,255,255,0.7);
    text-decoration: none;
    cursor: pointer;
    transition: all var(--transition);
    font-size: 13px;
    font-weight: 500;
}

.sidebar-nav-item:hover {
    background: rgba(255,255,255,0.06);
    color: #fff;
}

.sidebar-nav-item.active {
    background: rgba(99,102,241,0.2);
    color: #a5b4fc;
}

.sidebar-nav-item .icon {
    font-size: 16px;
    width: 24px;
    text-align: center;
}

.sidebar-nav-item .badge {
    margin-left: auto;
    padding: 1px 10px;
    border-radius: 12px;
    font-size: 9px;
    font-weight: 700;
    background: var(--primary);
    color: #fff;
}
.sidebar-nav-item .badge.danger { background: var(--danger); }
.sidebar-nav-item .badge.success { background: var(--success); }

.sidebar-footer {
    padding: 14px 16px;
    border-top: 1px solid var(--border-dark);
    flex-shrink: 0;
}

.sidebar-footer .user-info {
    display: flex;
    align-items: center;
    gap: 10px;
    color: rgba(255,255,255,0.7);
}

.sidebar-footer .user-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--primary-gradient);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
    color: #fff;
}

.sidebar-footer .user-name {
    font-size: 13px;
    font-weight: 600;
    color: #fff;
}

.sidebar-footer .user-email {
    font-size: 11px;
    color: rgba(255,255,255,0.4);
}

.sidebar-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 999;
    backdrop-filter: blur(4px);
}
.sidebar-overlay.active { display: block; }

.main {
    flex: 1;
    margin-left: var(--sidebar-width);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}

.topbar {
    height: var(--header-height);
    background: rgba(255,255,255,0.9);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    padding: 0 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 100;
}

.topbar-left { display: flex; align-items: center; gap: 16px; }
.topbar-menu-btn {
    display: none;
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 4px;
}

.topbar-title {
    font-size: 18px;
    font-weight: 700;
}
.topbar-title .sub {
    font-weight: 400;
    color: var(--text-muted);
    font-size: 13px;
}

.topbar-right { display: flex; align-items: center; gap: 12px; }
.topbar-status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-secondary);
    padding: 6px 12px;
    background: var(--bg-primary);
    border-radius: 20px;
}
.topbar-status .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--success);
    animation: pulse-dot 2s ease-in-out infinite;
}
@keyframes pulse-dot {
    0%,100% { opacity:1; }
    50% { opacity:0.5; }
}

.topbar-actions { display: flex; gap: 8px; }

.btn {
    padding: 8px 16px;
    border-radius: var(--radius-sm);
    border: none;
    font-weight: 600;
    font-size: 12px;
    cursor: pointer;
    transition: all var(--transition);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font);
}

.btn-primary {
    background: var(--primary-gradient);
    color: #fff;
}
.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(99,102,241,0.4); }

.btn-outline {
    background: transparent;
    color: var(--text-secondary);
    border: 1.5px solid var(--border);
}
.btn-outline:hover { background: var(--bg-primary); border-color: var(--primary); color: var(--primary); }

.btn-danger {
    background: var(--danger);
    color: #fff;
}
.btn-danger:hover { background: #dc2626; }

.btn-sm { padding: 5px 12px; font-size: 11px; }

.page-content {
    padding: 24px 28px;
    flex: 1;
}

.card {
    background: var(--bg-card);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    border: 1px solid var(--border);
    overflow: hidden;
    margin-bottom: 20px;
}

.card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid var(--border);
}

.card-title {
    font-size: 14px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
}
.card-title .emoji { font-size: 18px; }

.card-body { padding: 16px 20px; }

.empty-state {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-muted);
}
.empty-state .emoji { font-size: 48px; margin-bottom: 12px; }
.empty-state h3 { color: var(--text-primary); font-weight: 700; margin-bottom: 6px; }

.status-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 20px;
    border: 1px solid var(--border);
}

.toast-container {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    pointer-events: none;
}

.toast {
    pointer-events: auto;
    background: var(--bg-card);
    padding: 12px 24px;
    border-radius: var(--radius);
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
    font-weight: 600;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-left: 4px solid var(--primary);
    animation: slideUp 0.3s ease-out;
}
.toast.error { border-left-color: var(--danger); }
.toast.success { border-left-color: var(--success); }

@keyframes slideUp {
    from { opacity:0; transform:translateY(20px); }
    to { opacity:1; transform:translateY(0); }
}

.modal-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 2000;
    justify-content: center;
    align-items: center;
    padding: 20px;
    backdrop-filter: blur(4px);
}
.modal-overlay.active { display: flex; }

.modal {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    max-width: 560px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
    animation: modalIn 0.3s ease-out;
}
@keyframes modalIn {
    from { opacity:0; transform:scale(0.95) translateY(10px); }
    to { opacity:1; transform:scale(1) translateY(0); }
}

.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-bottom: 1px solid var(--border);
}
.modal-header h2 { font-size: 18px; font-weight: 700; }
.modal-close {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--text-muted);
    padding: 4px 8px;
}
.modal-body { padding: 20px 24px; }
.modal-footer {
    padding: 14px 24px;
    border-top: 1px solid var(--border);
    display: flex;
    gap: 8px;
    justify-content: flex-end;
}

@media (max-width: 1024px) {
    .sidebar { transform: translateX(-100%); }
    .sidebar.open { transform: translateX(0); }
    .main { margin-left: 0; }
    .topbar-menu-btn { display: block; }
    .topbar { padding: 0 16px; }
}

@media (max-width: 768px) {
    .topbar-status { display: none; }
    .topbar-title { font-size: 16px; }
    .topbar-title .sub { display: none; }
    .page-content { padding: 16px; }
}
'@

$cssContent | Out-File -FilePath "admin\css\admin.css" -Encoding UTF8
Write-Host "✅ admin/css/admin.css created" -ForegroundColor Green

Write-Host ""
Write-Host "🎉 Fix complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Start the server:" -ForegroundColor Yellow
Write-Host "   node server.js" -ForegroundColor White
Write-Host ""
Write-Host "🌐 Open:" -ForegroundColor Yellow
Write-Host "   http://localhost:3000/login.html" -ForegroundColor White