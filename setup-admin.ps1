# fix-admin.ps1 - Complete Admin Console Fix
Write-Host "🔧 Fixing LittleLoom Admin Console..." -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

$pagesDir = "admin\pages"
$cssDir = "admin\css"
$jsDir = "admin\js"

# Ensure directories exist
if (!(Test-Path $pagesDir)) { New-Item -ItemType Directory -Force -Path $pagesDir | Out-Null }

# ─── 1. FIX admin.css ──────────────────────────────────────────────
Write-Host "📝 Updating admin.css..." -ForegroundColor Yellow
@"
:root {
    --primary: #667eea;
    --primary-dark: #4f46e5;
    --primary-light: #818cf8;
    --secondary: #fa709a;
    --accent: #43e97b;
    --bg-primary: #f0f2f8;
    --bg-card: #ffffff;
    --bg-sidebar: #0f0f1a;
    --text-primary: #0f0f1a;
    --text-secondary: #4b5563;
    --text-muted: #6b7280;
    --text-white: #ffffff;
    --border: rgba(0, 0, 0, 0.06);
    --border-dark: rgba(255, 255, 255, 0.06);
    --shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
    --shadow-lg: 0 12px 48px rgba(0, 0, 0, 0.12);
    --radius: 16px;
    --radius-sm: 10px;
    --radius-lg: 24px;
    --radius-xl: 32px;
    --transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    --sidebar-width: 280px;
    --header-height: 70px;
    --font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    --modal-overlay: rgba(0,0,0,0.5);
}

* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: var(--font); background: var(--bg-primary); color: var(--text-primary); line-height: 1.6; min-height: 100vh; }
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--primary-light); border-radius: 10px; }

.app { display: flex; min-height: 100vh; }
.sidebar { width: var(--sidebar-width); background: var(--bg-sidebar); position: fixed; top: 0; left: 0; bottom: 0; z-index: 1000; display: flex; flex-direction: column; transition: transform var(--transition); overflow-y: auto; overflow-x: hidden; }
.sidebar-brand { padding: 20px 24px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--border-dark); min-height: var(--header-height); }
.brand-icon { width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, var(--primary), var(--secondary)); display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
.logo-title { font-weight: 800; font-size: 18px; color: var(--text-white); letter-spacing: -0.5px; }
.logo-sub { font-weight: 400; color: rgba(255,255,255,0.5); font-size: 12px; display: block; }

.sidebar-nav { flex: 1; padding: 12px 12px; overflow-y: auto; }
.sidebar-nav-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: rgba(255,255,255,0.25); padding: 12px 12px 6px; margin-top: 4px; }
.sidebar-nav-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: var(--radius-sm); color: rgba(255,255,255,0.6); text-decoration: none; cursor: pointer; transition: var(--transition); font-size: 13px; font-weight: 500; position: relative; margin-bottom: 1px; }
.sidebar-nav-item:hover { background: rgba(255,255,255,0.06); color: var(--text-white); }
.sidebar-nav-item.active { background: rgba(102,126,234,0.2); color: var(--primary-light); }
.sidebar-nav-item .icon { font-size: 16px; width: 24px; text-align: center; flex-shrink: 0; }
.sidebar-nav-item .badge { margin-left: auto; padding: 1px 10px; border-radius: 12px; font-size: 9px; font-weight: 700; background: var(--primary); color: #fff; }
.sidebar-nav-item .badge.danger { background: #ef4444; }
.sidebar-nav-item .badge.success { background: #22c55e; }
.sidebar-nav-item .badge.warning { background: #f59e0b; }

.sidebar-footer { padding: 16px 20px; border-top: 1px solid var(--border-dark); }
.sidebar-footer .user-info { display: flex; align-items: center; gap: 10px; color: rgba(255,255,255,0.7); }
.sidebar-footer .user-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; color: #fff; flex-shrink: 0; }
.sidebar-footer .user-name { font-size: 14px; font-weight: 600; color: var(--text-white); }
.sidebar-footer .user-email { font-size: 11px; color: rgba(255,255,255,0.4); }

.main { flex: 1; margin-left: var(--sidebar-width); min-height: 100vh; }
.topbar { height: var(--header-height); background: var(--bg-card); border-bottom: 1px solid var(--border); padding: 0 32px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; backdrop-filter: blur(12px); background: rgba(255,255,255,0.92); }
.topbar-left { display: flex; align-items: center; gap: 16px; }
.topbar-menu-btn { display: none; background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary); padding: 4px; }
.topbar-title { font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }
.topbar-title .sub { font-weight: 400; color: var(--text-muted); font-size: 14px; }
.topbar-right { display: flex; align-items: center; gap: 16px; }
.topbar-status { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); }
.topbar-status .dot { width: 10px; height: 10px; border-radius: 50%; background: #22c55e; animation: pulse-dot 2s ease-in-out infinite; }
@keyframes pulse-dot { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(0.85); } }
.topbar-actions { display: flex; align-items: center; gap: 8px; }

.btn { padding: 8px 18px; border-radius: var(--radius-sm); border: none; font-weight: 600; font-size: 13px; cursor: pointer; transition: var(--transition); display: inline-flex; align-items: center; gap: 6px; font-family: var(--font); }
.btn-primary { background: var(--primary); color: #fff; }
.btn-primary:hover { background: var(--primary-dark); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(102,126,234,0.35); }
.btn-outline { background: transparent; color: var(--text-secondary); border: 1.5px solid var(--border); }
.btn-outline:hover { background: var(--bg-primary); border-color: var(--primary); color: var(--primary); }
.btn-danger { background: #ef4444; color: #fff; }
.btn-danger:hover { background: #dc2626; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(239,68,68,0.3); }
.btn-success { background: #22c55e; color: #fff; }
.btn-success:hover { background: #16a34a; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(34,197,94,0.3); }
.btn-warning { background: #f59e0b; color: #fff; }
.btn-warning:hover { background: #d97706; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(245,158,11,0.3); }
.btn-sm { padding: 4px 12px; font-size: 11px; }
.btn-xs { padding: 2px 8px; font-size: 10px; }

.status-bar { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-radius: var(--radius-sm); background: var(--bg-primary); font-size: 13px; color: var(--text-secondary); margin-bottom: 20px; border: 1px solid var(--border); }
.toast-container { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 9999; pointer-events: none; }
.toast { pointer-events: auto; background: var(--bg-card); padding: 12px 24px; border-radius: var(--radius); box-shadow: var(--shadow-lg); font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 10px; border-left: 4px solid var(--primary); animation: slideUp 0.3s ease-out; }
.toast.error { border-left-color: #ef4444; }
.toast.success { border-left-color: #22c55e; }
.toast.warning { border-left-color: #f59e0b; }
@keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }

.sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 999; }
.sidebar-overlay.active { display: block; }

@media (max-width: 768px) { .sidebar { transform: translateX(-100%); } .sidebar.open { transform: translateX(0); } .main { margin-left: 0; } .topbar-menu-btn { display: block; } .topbar { padding: 0 16px; } .topbar-status { display: none; } }

.badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.badge-success { background: #dcfce7; color: #16a34a; }
.badge-warning { background: #fef3c7; color: #d97706; }
.badge-danger { background: #fee2e2; color: #dc2626; }
.badge-info { background: #dbeafe; color: #2563eb; }
.badge-purple { background: #ede9fe; color: #7c3aed; }
.badge-gray { background: #f3f4f6; color: #6b7280; }
.pill { display: inline-block; padding: 2px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; background: var(--bg-primary); color: var(--text-secondary); }

.card { background: var(--bg-card); border-radius: var(--radius-lg); box-shadow: var(--shadow); border: 1px solid var(--border); overflow: hidden; margin-bottom: 24px; transition: var(--transition); }
.card:hover { box-shadow: var(--shadow-lg); }
.card-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; border-bottom: 1px solid var(--border); flex-wrap: wrap; gap: 8px; }
.card-title { font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
.card-title .emoji { font-size: 20px; }
.card-body { padding: 20px 24px; }

.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th { text-align: left; font-weight: 600; color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 8px 10px 0; border-bottom: 1.5px solid var(--border); }
td { padding: 12px 8px 12px 0; border-bottom: 1px solid var(--border); vertical-align: middle; }

.empty-state { text-align: center; padding: 40px 20px; color: var(--text-muted); }
.empty-state .emoji { font-size: 48px; margin-bottom: 12px; }
.empty-state h3 { color: var(--text-primary); font-weight: 700; margin-bottom: 6px; }

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
@media (max-width: 1200px) { .grid-2 { grid-template-columns: 1fr; } .grid-3 { grid-template-columns: 1fr 1fr; } .grid-4 { grid-template-columns: 1fr 1fr; } }
@media (max-width: 600px) { .grid-3 { grid-template-columns: 1fr; } .grid-4 { grid-template-columns: 1fr; } }

.stat-card { background: var(--bg-card); border-radius: var(--radius); padding: 18px 20px; box-shadow: var(--shadow); transition: var(--transition); border: 1px solid var(--border); }
.stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
.stat-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 4px; }
.stat-value { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
.stat-value .unit { font-size: 16px; font-weight: 600; color: var(--text-muted); margin-left: 4px; }
.stat-change { font-size: 12px; font-weight: 600; margin-top: 4px; }
.stat-change.positive { color: #22c55e; }
.stat-change.negative { color: #ef4444; }
.stat-change.neutral { color: var(--text-muted); }

.page { padding: 24px 32px; animation: fadeIn 0.3s ease-out; display: none; }
.page.active { display: block; }
@keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }

.page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
.page-header .icon { font-size: 32px; }
.page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.3px; }
.page-header .badge { margin-left: 12px; }
.page-actions { margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; }

.progress-bar { height: 6px; background: var(--bg-primary); border-radius: 3px; overflow: hidden; position: relative; }
.progress-bar .fill { height: 100%; border-radius: 3px; transition: width 0.6s ease; background: linear-gradient(90deg, var(--primary), var(--primary-light)); }
.progress-bar .fill.danger { background: linear-gradient(90deg, #ef4444, #f87171); }
.progress-bar .fill.success { background: linear-gradient(90deg, #22c55e, #4ade80); }
.progress-bar .fill.warning { background: linear-gradient(90deg, #f59e0b, #fbbf24); }

.filter-bar { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; padding: 12px 16px; background: var(--bg-primary); border-radius: var(--radius-sm); border: 1px solid var(--border); }
.filter-bar input, .filter-bar select { padding: 6px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); font-size: 13px; font-family: var(--font); background: var(--bg-card); color: var(--text-primary); }
.filter-bar input:focus, .filter-bar select:focus { outline: none; border-color: var(--primary); }

.modal-overlay { display: none; position: fixed; inset: 0; background: var(--modal-overlay); z-index: 2000; justify-content: center; align-items: center; padding: 20px; backdrop-filter: blur(4px); }
.modal-overlay.active { display: flex; }
.modal { background: var(--bg-card); border-radius: var(--radius-lg); max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: var(--shadow-lg); padding: 0; animation: modalIn 0.3s ease-out; }
@keyframes modalIn { from { opacity:0; transform:scale(0.95) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--border); }
.modal-header h2 { font-size: 18px; font-weight: 700; }
.modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted); padding: 4px 8px; border-radius: 8px; transition: var(--transition); }
.modal-close:hover { background: var(--bg-primary); }
.modal-body { padding: 24px; }
.modal-footer { padding: 16px 24px; border-top: 1px solid var(--border); display: flex; gap: 8px; justify-content: flex-end; }

.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-weight: 600; font-size: 13px; margin-bottom: 4px; color: var(--text-secondary); }
.form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px 14px; border-radius: var(--radius-sm); border: 1.5px solid var(--border); font-size: 14px; font-family: var(--font); background: var(--bg-card); color: var(--text-primary); transition: var(--transition); }
.form-group input:focus, .form-group select:focus, .form-group textarea:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
.form-group textarea { min-height: 80px; resize: vertical; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

.toggle { position: relative; width: 44px; height: 24px; background: #d1d5db; border-radius: 12px; cursor: pointer; transition: var(--transition); flex-shrink: 0; }
.toggle.active { background: var(--primary); }
.toggle .slider { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; background: #fff; border-radius: 50%; transition: var(--transition); box-shadow: 0 2px 4px rgba(0,0,0,0.15); }
.toggle.active .slider { left: 22px; }

.action-btn { padding: 4px 8px; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; background: transparent; transition: var(--transition); }
.action-btn:hover { background: var(--bg-primary); }
.action-btn.danger:hover { background: #fee2e2; }

.spinner { display: inline-block; width: 18px; height: 18px; border: 2px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 4px; }
.status-dot.online { background: #22c55e; }
.status-dot.offline { background: #ef4444; }
.status-dot.warning { background: #f59e0b; }
.status-dot.pending { background: #f59e0b; animation: pulse-dot 1.5s ease-in-out infinite; }

.activity-feed { display: flex; flex-direction: column; gap: 4px; }
.activity-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
.activity-item:last-child { border-bottom: none; }
.activity-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; background: var(--bg-primary); }
.activity-content { flex: 1; min-width: 0; }
.activity-title { font-weight: 600; font-size: 14px; }
.activity-meta { font-size: 12px; color: var(--text-muted); }
.activity-time { font-size: 11px; color: var(--text-muted); white-space: nowrap; }

.chart-placeholder { height: 200px; background: var(--bg-primary); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-weight: 500; font-size: 14px; position: relative; overflow: hidden; }
.chart-placeholder .bars { display: flex; align-items: flex-end; gap: 12px; height: 140px; }
.chart-placeholder .bar { width: 28px; border-radius: 6px 6px 0 0; background: linear-gradient(180deg, var(--primary), var(--primary-light)); transition: height 1s ease; min-height: 8px; }

@media (max-width: 768px) { .page { padding: 16px; } .form-row { grid-template-columns: 1fr; } .modal { margin: 10px; max-height: 95vh; } }
"@ | Out-File -FilePath "$cssDir\admin.css" -Encoding UTF8
Write-Host "✅ admin.css updated" -ForegroundColor Green

# ─── 2. FIX admin.js ───────────────────────────────────────────────
Write-Host "📝 Updating admin.js..." -ForegroundColor Yellow
@"
// ─── SUPABASE CONFIG ──────────────────────────────────────────────
const SUPABASE_URL = 'https://qoozrrljpgsyhxfqxnzf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RNzz7jvsGmrRp9c94JiPuA_ooZt_gmm';

let supabase = null;
let session = null;
let refreshTimer = null;
let realtimeChannel = null;

function initSupabase() {
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return true;
    } catch (e) { console.error('Supabase init error:', e); return false; }
}

function showToast(message, type) {
    type = type || 'info';
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.id = 'toastContainer';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function() { if (toast.parentNode) toast.remove(); }, 4000);
}

async function checkAuth() {
    try {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) {
            const statusBar = document.getElementById('statusBar');
            if (statusBar) statusBar.innerHTML = '<span>🔒 Please log in</span>';
            return false;
        }
        session = data.session;
        const statusEl = document.getElementById('connectionStatus');
        if (statusEl) statusEl.textContent = 'Logged in as ' + session.user.email;
        const emailEl = document.getElementById('sidebarEmail');
        if (emailEl) emailEl.textContent = session.user.email;
        const nameEl = document.getElementById('sidebarName');
        const avatarEl = document.getElementById('sidebarAvatar');
        if (nameEl) {
            const name = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
            nameEl.textContent = name;
            if (avatarEl) avatarEl.textContent = name[0].toUpperCase();
        }
        return true;
    } catch (e) { console.error('Auth check error:', e); return false; }
}

async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        await supabase.auth.signOut();
        session = null;
        showToast('Logged out successfully', 'success');
        const statusEl = document.getElementById('connectionStatus');
        if (statusEl) statusEl.textContent = 'Disconnected';
        window.location.href = '/admin/dashboard.html';
    }
}

function toggleSidebar(open) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (open === undefined) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    } else if (open) {
        sidebar.classList.add('open');
        overlay.classList.add('active');
    } else {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    }
}

let modalResolve = null;
let modalData = null;

function openModal(title, bodyHTML, confirmText, confirmAction) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('modalOverlay');
        if (!overlay) return;
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = bodyHTML;
        document.getElementById('modalConfirmBtn').textContent = confirmText || 'Confirm';
        overlay.classList.add('active');
        modalResolve = resolve;
        modalData = { confirmAction };
    });
}

function closeModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.remove('active');
    if (modalResolve) {
        modalResolve(null);
        modalResolve = null;
    }
}

function modalConfirm() {
    if (modalData && modalData.confirmAction) {
        modalData.confirmAction();
    }
    closeModal();
}

function safeSetText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function safeSetHTML(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = value;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString();
}

function formatDateShort(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString();
}

function timeAgo(dateStr) {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    const days = Math.floor(hours / 24);
    if (days < 7) return days + 'd ago';
    return new Date(dateStr).toLocaleDateString();
}

window.showToast = showToast;
window.handleLogout = handleLogout;
window.toggleSidebar = toggleSidebar;
window.openModal = openModal;
window.closeModal = closeModal;
window.modalConfirm = modalConfirm;
window.safeSetText = safeSetText;
window.safeSetHTML = safeSetHTML;
window.formatDate = formatDate;
window.formatDateShort = formatDateShort;
window.timeAgo = timeAgo;
window.initSupabase = initSupabase;
window.checkAuth = checkAuth;
window.session = session;
"@ | Out-File -FilePath "$jsDir\admin.js" -Encoding UTF8
Write-Host "✅ admin.js updated" -ForegroundColor Green

# ─── 3. CREATE ALL PAGE FILES ──────────────────────────────────────
Write-Host "📄 Creating all page files..." -ForegroundColor Yellow

# Function to create a page file
function Create-PageFile {
    param($Name, $Title, $Icon, $PageType)
    
    $content = @"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>$Title - LittleLoom Admin</title>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/admin/css/admin.css" />
    <style>
        body { padding: 20px; background: var(--bg-primary); }
        .page-container { max-width: 1400px; margin: 0 auto; }
        .page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
        .page-header h1 { font-size: 24px; font-weight: 700; }
        .page-actions { margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; }
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px; }
        .stat-card { background: var(--bg-card); padding: 16px; border-radius: var(--radius); border: 1px solid var(--border); text-align: center; }
        .stat-card .num { font-size: 24px; font-weight: 800; }
        .stat-card .label { font-size: 12px; color: var(--text-muted); }
        .filter-bar { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; padding: 12px 16px; background: var(--bg-primary); border-radius: var(--radius-sm); border: 1px solid var(--border); }
        .filter-bar input, .filter-bar select { padding: 6px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); font-size: 13px; font-family: var(--font); background: var(--bg-card); color: var(--text-primary); flex: 1; min-width: 120px; }
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th { text-align: left; font-weight: 600; color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 8px 10px 0; border-bottom: 1.5px solid var(--border); }
        td { padding: 12px 8px 12px 0; border-bottom: 1px solid var(--border); vertical-align: middle; }
        .empty-state { text-align: center; padding: 40px 20px; color: var(--text-muted); }
        .empty-state .emoji { font-size: 48px; margin-bottom: 12px; }
        .empty-state h3 { color: var(--text-primary); font-weight: 700; margin-bottom: 6px; }
        .action-btn { padding: 4px 8px; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; background: transparent; transition: var(--transition); }
        .action-btn:hover { background: var(--bg-primary); }
        .action-btn.danger:hover { background: #fee2e2; }
        .card { background: var(--bg-card); border-radius: var(--radius-lg); box-shadow: var(--shadow); border: 1px solid var(--border); overflow: hidden; margin-bottom: 24px; }
        .card-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; border-bottom: 1px solid var(--border); flex-wrap: wrap; gap: 8px; }
        .card-title { font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
        .card-title .emoji { font-size: 20px; }
        .card-body { padding: 20px 24px; }
        .badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .badge-success { background: #dcfce7; color: #16a34a; }
        .badge-warning { background: #fef3c7; color: #d97706; }
        .badge-danger { background: #fee2e2; color: #dc2626; }
        .badge-info { background: #dbeafe; color: #2563eb; }
        .badge-purple { background: #ede9fe; color: #7c3aed; }
        .badge-gray { background: #f3f4f6; color: #6b7280; }
        .pill { display: inline-block; padding: 2px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; background: var(--bg-primary); color: var(--text-secondary); }
        .activity-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
        .activity-item:last-child { border-bottom: none; }
        .activity-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; background: var(--bg-primary); }
        .activity-content { flex: 1; }
        .activity-title { font-weight: 600; font-size: 14px; }
        .activity-meta { font-size: 12px; color: var(--text-muted); }
        .activity-time { font-size: 11px; color: var(--text-muted); white-space: nowrap; }
    </style>
</head>
<body>
    <div class="page-container">
        <div class="page-header">
            <span class="icon" style="font-size:32px;">$Icon</span>
            <h1>$Title <span style="font-size:14px;font-weight:400;color:var(--text-muted);" id="countDisplay">0</span></h1>
            <div class="page-actions">
                <button class="btn btn-primary" onclick="handleAdd()">➕ Add</button>
                <button class="btn btn-outline" onclick="loadData()">🔄 Refresh</button>
            </div>
        </div>
        
        <div class="stat-grid" id="statsGrid">
            <div class="stat-card"><div class="num" id="stat1">0</div><div class="label">Total</div></div>
            <div class="stat-card"><div class="num" id="stat2">0</div><div class="label">Active</div></div>
            <div class="stat-card"><div class="num" id="stat3">0</div><div class="label">Today</div></div>
        </div>
        
        <div class="filter-bar">
            <input type="text" placeholder="Search..." id="searchInput" oninput="filterData()">
            <select id="filterSelect" onchange="filterData()">
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
            </select>
        </div>
        
        <div class="card">
            <div class="card-body">
                <div class="table-wrap">
                    <table>
                        <thead id="tableHead"></thead>
                        <tbody id="tableBody"><tr><td colspan="5" class="empty-state"><div class="emoji">📊</div><h3>Loading data...</h3></td></tr></tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
    
    <script src="/admin/js/admin.js"></script>
    <script>
        let dataCache = [];
        let pageType = '$PageType';
        
        async function loadData() {
            if (!initSupabase()) { showToast('Failed to init Supabase', 'error'); return; }
            const authed = await checkAuth();
            if (!authed) { showToast('Please log in', 'warning'); return; }
            
            try {
                let tableName = '$PageType';
                let { data, error } = await supabase.from(tableName).select('*').limit(50);
                if (error) throw error;
                
                dataCache = data || [];
                renderData(dataCache);
                
                document.getElementById('stat1').textContent = dataCache.length;
                document.getElementById('stat2').textContent = dataCache.filter(d => d.is_active !== false).length;
                document.getElementById('stat3').textContent = dataCache.filter(d => {
                    if (d.created_at) {
                        const today = new Date().toDateString();
                        return new Date(d.created_at).toDateString() === today;
                    }
                    return false;
                }).length;
                document.getElementById('countDisplay').textContent = dataCache.length + ' items';
                
                showToast('✅ Data loaded successfully', 'success');
            } catch (e) {
                console.error('Load error:', e);
                document.getElementById('tableBody').innerHTML = '<tr><td colspan="5" class="empty-state"><div class="emoji">❌</div><h3>Error loading data</h3><p>' + e.message + '</p></td></tr>';
                showToast('Error loading data: ' + e.message, 'error');
            }
        }
        
        function renderData(data) {
            const tbody = document.getElementById('tableBody');
            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><div class="emoji">📭</div><h3>No data found</h3></td></tr>';
                return;
            }
            
            let headers = Object.keys(data[0]).filter(k => !['id', 'password', 'token'].includes(k)).slice(0, 4);
            document.getElementById('tableHead').innerHTML = '<tr>' + headers.map(h => '<th>' + h.replace(/_/g, ' ').toUpperCase() + '</th>').join('') + '<th>Actions</th></tr>';
            
            let html = '';
            data.slice(0, 20).forEach(function(item) {
                html += '<tr>';
                headers.forEach(function(h) {
                    let val = item[h];
                    if (val === null || val === undefined) val = '—';
                    else if (typeof val === 'string' && val.length > 30) val = val.substring(0, 30) + '...';
                    else if (typeof val === 'boolean') val = val ? '✅' : '❌';
                    else if (h.includes('_at') || h === 'created_at' || h === 'updated_at') {
                        val = new Date(val).toLocaleString();
                    }
                    html += '<td>' + val + '</td>';
                });
                html += '<td><button class="action-btn" onclick="viewItem(\'' + item.id + '\')">👁️</button> <button class="action-btn" onclick="editItem(\'' + item.id + '\')">✏️</button> <button class="action-btn danger" onclick="deleteItem(\'' + item.id + '\')">🗑️</button></td>';
                html += '</tr>';
            });
            tbody.innerHTML = html;
        }
        
        function filterData() {
            const search = document.getElementById('searchInput')?.value?.toLowerCase() || '';
            const filter = document.getElementById('filterSelect')?.value || 'all';
            
            let filtered = dataCache;
            if (search) filtered = filtered.filter(d => JSON.stringify(d).toLowerCase().includes(search));
            if (filter === 'active') filtered = filtered.filter(d => d.is_active !== false);
            else if (filter === 'inactive') filtered = filtered.filter(d => d.is_active === false);
            
            renderData(filtered);
        }
        
        function handleAdd() {
            showToast('Add functionality coming soon', 'info');
        }
        
        async function viewItem(id) {
            const item = dataCache.find(d => d.id === id);
            if (!item) { showToast('Item not found', 'error'); return; }
            let details = '<div style="display:grid;gap:8px;">';
            Object.entries(item).forEach(([key, val]) => {
                if (key === 'id') return;
                let displayVal = val;
                if (typeof val === 'boolean') displayVal = val ? '✅ Yes' : '❌ No';
                else if (val && typeof val === 'string' && val.length > 100) displayVal = val.substring(0, 100) + '...';
                else if (val === null || val === undefined) displayVal = '—';
                details += '<div><strong>' + key.replace(/_/g, ' ') + ':</strong> ' + displayVal + '</div>';
            });
            details += '</div>';
            openModal('📄 Details', details, 'Close', closeModal);
        }
        
        async function editItem(id) {
            const item = dataCache.find(d => d.id === id);
            if (!item) { showToast('Item not found', 'error'); return; }
            let form = '<div class="form-group"><label>ID</label><input type="text" value="' + id + '" disabled></div>';
            Object.entries(item).forEach(([key, val]) => {
                if (key === 'id' || key === 'created_at' || key === 'updated_at') return;
                let displayVal = val === null || val === undefined ? '' : String(val);
                form += '<div class="form-group"><label>' + key.replace(/_/g, ' ') + '</label><input type="text" id="edit_' + key + '" value="' + displayVal + '"></div>';
            });
            openModal('✏️ Edit Item', form, 'Save', async function() {
                let updates = {};
                Object.entries(item).forEach(([key, val]) => {
                    if (key === 'id' || key === 'created_at' || key === 'updated_at') return;
                    const input = document.getElementById('edit_' + key);
                    if (input) {
                        let value = input.value;
                        if (typeof val === 'number') value = parseFloat(value);
                        else if (typeof val === 'boolean') value = value === 'true';
                        updates[key] = value;
                    }
                });
                try {
                    const { error } = await supabase.from(pageType).update(updates).eq('id', id);
                    if (error) throw error;
                    showToast('✅ Item updated successfully', 'success');
                    closeModal();
                    loadData();
                } catch (e) {
                    showToast('Error updating: ' + e.message, 'error');
                }
            });
        }
        
        async function deleteItem(id) {
            if (!confirm('Are you sure you want to delete this item?')) return;
            try {
                const { error } = await supabase.from(pageType).update({ is_active: false }).eq('id', id);
                if (error) throw error;
                showToast('✅ Item deleted successfully', 'success');
                loadData();
            } catch (e) {
                showToast('Error deleting: ' + e.message, 'error');
            }
        }
        
        document.addEventListener('DOMContentLoaded', function() {
            // Set up table head
            document.getElementById('tableHead').innerHTML = '<tr><th>ID</th><th>Name</th><th>Status</th><th>Created</th><th>Actions</th></tr>';
            setTimeout(loadData, 500);
        });
    </script>
</body>
</html>
"@
    $filePath = "$pagesDir\$Name.html"
    $content | Out-File -FilePath $filePath -Encoding UTF8
    Write-Host "✅ Created $Name.html" -ForegroundColor Green
}

# Create all pages with proper names
$pages = @(
    @{Name="babies"; Title="Babies"; Icon="👶"; Type="babies"},
    @{Name="users"; Title="Users"; Icon="👤"; Type="profiles"},
    @{Name="moderation"; Title="Moderation"; Icon="🛡️"; Type="community_posts"},
    @{Name="community"; Title="Community"; Icon="💬"; Type="community_posts"},
    @{Name="topics"; Title="Topics"; Icon="📌"; Type="community_topics"},
    @{Name="trackers"; Title="Trackers"; Icon="📈"; Type="tracker_entries"},
    @{Name="milestones"; Title="Milestones"; Icon="🏆"; Type="tracker_entries"},
    @{Name="analytics"; Title="Analytics"; Icon="📈"; Type="babies"},
    @{Name="performance"; Title="Performance"; Icon="⚡"; Type="babies"},
    @{Name="realtime"; Title="Realtime"; Icon="🔄"; Type="babies"},
    @{Name="health"; Title="Health"; Icon="❤️"; Type="babies"},
    @{Name="audit"; Title="Audit"; Icon="📋"; Type="babies"},
    @{Name="notifications"; Title="Notifications"; Icon="🔔"; Type="babies"},
    @{Name="features"; Title="Features"; Icon="🚩"; Type="babies"},
    @{Name="export"; Title="Export"; Icon="📤"; Type="babies"},
    @{Name="api"; Title="API"; Icon="🔑"; Type="babies"},
    @{Name="support"; Title="Support"; Icon="🎫"; Type="babies"},
    @{Name="announcements"; Title="Announcements"; Icon="📢"; Type="babies"},
    @{Name="settings"; Title="Settings"; Icon="⚙️"; Type="babies"},
    @{Name="backup"; Title="Backup"; Icon="💾"; Type="babies"}
)

foreach ($page in $pages) {
    Create-PageFile -Name $page.Name -Title $page.Title -Icon $page.Icon -PageType $page.Type
}

Write-Host ""
Write-Host "🎉 All pages created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Restart the server:" -ForegroundColor Yellow
Write-Host "   node server.js" -ForegroundColor White
Write-Host ""
Write-Host "🌐 Open in browser:" -ForegroundColor Yellow
Write-Host "   http://localhost:3000/admin/dashboard.html" -ForegroundColor White