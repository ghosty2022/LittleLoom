# ─── fix-admin-session.ps1 ──────────────────────────────────────────────
# Run this script from: PS C:\Users\ondie\Desktop\LittleLoom\admin>
# 
# USAGE: .\fix-admin-session.ps1
#
# This script will:
# 1. Centralize session management in admin.js
# 2. Fix CRUD operations to properly sync with Supabase
# 3. Remove unnecessary page reloads
# 4. Add proper role-based access control
# 5. Fix display name and data editing issues

Write-Host "🧵 LittleLoom Admin Fix - Session & CRUD Management" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

# ─── Check if we're in the right directory ──────────────────────────────
$currentDir = Get-Location
if ($currentDir.Path -notlike "*LittleLoom\admin*") {
    Write-Host "⚠️  WARNING: You are not in the admin directory!" -ForegroundColor Yellow
    Write-Host "Current directory: $($currentDir.Path)" -ForegroundColor Yellow
    Write-Host "Please run this script from: C:\Users\ondie\Desktop\LittleLoom\admin" -ForegroundColor Yellow
    $response = Read-Host "Continue anyway? (y/n)"
    if ($response -ne 'y') { exit }
}

Write-Host "📁 Working directory: $($currentDir.Path)" -ForegroundColor Green

# ─── Backup existing files ──────────────────────────────────────────────
Write-Host "`n📦 Creating backups..." -ForegroundColor Yellow
$backupDir = "backup_$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss')"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

if (Test-Path "admin.js") {
    Copy-Item "admin.js" "$backupDir\admin.js.bak"
    Write-Host "  ✅ admin.js backed up"
}
if (Test-Path "dashboard.html") {
    Copy-Item "dashboard.html" "$backupDir\dashboard.html.bak"
    Write-Host "  ✅ dashboard.html backed up"
}

Write-Host "📁 Backups saved to: $backupDir" -ForegroundColor Green

# ─── FIX admin.js - Centralized Session Management ─────────────────────
Write-Host "`n🔧 Updating admin.js with centralized session management..." -ForegroundColor Yellow

$adminJsContent = @"
// ─── admin.js - Centralized Session & CRUD Management ──────────────────
// This file is loaded by ALL admin pages - DO NOT duplicate session logic!

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────
const SUPABASE_URL = 'https://qoozrrljpgsyhxfqxnzf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RNzz7jvsGmrRp9c94JiPuA_ooZt_gmm';

let supabase = null;
let session = null;
let currentUserRole = 'guest';
let userPermissions = {};

// ─── SESSION STORAGE KEYS ──────────────────────────────────────────────
const SESSION_KEYS = {
    SESSION_DATA: 'littleloom_session_data',
    SESSION_EXPIRY: 'littleloom_session_expiry',
    REMEMBER_ME: 'littleloom_remember_me',
    USER_ROLE: 'littleloom_user_role',
};

// ─── SESSION TIMEOUT ──────────────────────────────────────────────────────
const SESSION_TIMEOUT_MINUTES = 30;
let sessionTimer = null;
let sessionTimeRemaining = SESSION_TIMEOUT_MINUTES * 60;
let sessionWarningShown = false;
let sessionCountdownInterval = null;

// ─── SUPER ADMIN USER ID ─────────────────────────────────────────────────
const SUPER_ADMIN_USER_ID = 'a3f834ef-7fa5-4732-9a03-af154806ac16';

// ─── ADMIN ROLE PERMISSIONS ──────────────────────────────────────────────
const ADMIN_ROLES = {
    'super_admin': {
        label: 'Super Admin',
        badge: 'super-admin',
        permissions: {
            canManageAdmins: true,
            canManageUsers: true,
            canManageContent: true,
            canModerate: true,
            canViewAnalytics: true,
            canManageSystem: true,
            canManageBackup: true,
            canViewAudit: true,
            canManageAPI: true,
            canManageFeatures: true,
            canDelete: true,
            canEdit: true,
            canCreate: true
        }
    },
    'content_manager': {
        label: 'Content Manager',
        badge: 'content-manager',
        permissions: {
            canManageAdmins: false,
            canManageUsers: false,
            canManageContent: true,
            canModerate: true,
            canViewAnalytics: true,
            canManageSystem: false,
            canManageBackup: false,
            canViewAudit: false,
            canManageAPI: false,
            canManageFeatures: false,
            canDelete: true,
            canEdit: true,
            canCreate: true
        }
    },
    'user_manager': {
        label: 'User Manager',
        badge: 'user-manager',
        permissions: {
            canManageAdmins: false,
            canManageUsers: true,
            canManageContent: false,
            canModerate: false,
            canViewAnalytics: true,
            canManageSystem: false,
            canManageBackup: false,
            canViewAudit: false,
            canManageAPI: false,
            canManageFeatures: false,
            canDelete: false,
            canEdit: true,
            canCreate: true
        }
    },
    'moderation_manager': {
        label: 'Moderation Manager',
        badge: 'moderation-manager',
        permissions: {
            canManageAdmins: false,
            canManageUsers: false,
            canManageContent: false,
            canModerate: true,
            canViewAnalytics: true,
            canManageSystem: false,
            canManageBackup: false,
            canViewAudit: false,
            canManageAPI: false,
            canManageFeatures: false,
            canDelete: true,
            canEdit: false,
            canCreate: false
        }
    },
    'analytics_viewer': {
        label: 'Analytics Viewer',
        badge: 'analytics-viewer',
        permissions: {
            canManageAdmins: false,
            canManageUsers: false,
            canManageContent: false,
            canModerate: false,
            canViewAnalytics: true,
            canManageSystem: false,
            canManageBackup: false,
            canViewAudit: false,
            canManageAPI: false,
            canManageFeatures: false,
            canDelete: false,
            canEdit: false,
            canCreate: false
        }
    }
};

// ─── INIT ──────────────────────────────────────────────────────────────────
function initSupabase() {
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase initialized');
        return true;
    } catch (e) {
        console.error('Supabase init error:', e);
        return false;
    }
}

// ─── SESSION PERSISTENCE ──────────────────────────────────────────────────
function saveSessionData(data) {
    try {
        sessionStorage.setItem(SESSION_KEYS.SESSION_DATA, JSON.stringify(data));
        const expiryTime = Date.now() + (SESSION_TIMEOUT_MINUTES * 60 * 1000);
        sessionStorage.setItem(SESSION_KEYS.SESSION_EXPIRY, expiryTime.toString());
        
        const rememberMe = localStorage.getItem(SESSION_KEYS.REMEMBER_ME);
        if (rememberMe === 'true') {
            localStorage.setItem(SESSION_KEYS.SESSION_DATA, JSON.stringify(data));
            localStorage.setItem(SESSION_KEYS.SESSION_EXPIRY, expiryTime.toString());
        }
    } catch (e) {
        console.warn('Could not save session data:', e);
    }
}

function getSessionData() {
    try {
        let data = sessionStorage.getItem(SESSION_KEYS.SESSION_DATA);
        let expiry = sessionStorage.getItem(SESSION_KEYS.SESSION_EXPIRY);
        
        if (!data) {
            data = localStorage.getItem(SESSION_KEYS.SESSION_DATA);
            expiry = localStorage.getItem(SESSION_KEYS.SESSION_EXPIRY);
        }
        
        if (data && expiry) {
            const expiryTime = parseInt(expiry, 10);
            if (Date.now() < expiryTime) {
                return JSON.parse(data);
            }
        }
        return null;
    } catch (e) {
        return null;
    }
}

function clearSessionData() {
    sessionStorage.removeItem(SESSION_KEYS.SESSION_DATA);
    sessionStorage.removeItem(SESSION_KEYS.SESSION_EXPIRY);
    localStorage.removeItem(SESSION_KEYS.SESSION_DATA);
    localStorage.removeItem(SESSION_KEYS.SESSION_EXPIRY);
    localStorage.removeItem(SESSION_KEYS.REMEMBER_ME);
}

function setRememberMe(value) {
    localStorage.setItem(SESSION_KEYS.REMEMBER_ME, value ? 'true' : 'false');
}

// ─── TOAST ────────────────────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 4000) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.id = 'toastContainer';
        document.body.appendChild(container);
    }

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast \${type}`;
    toast.innerHTML = `<span>\${icons[type] || 'ℹ️'}</span> \${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            setTimeout(() => toast.remove(), 300);
        }
    }, duration);
}

// ─── MODAL ────────────────────────────────────────────────────────────────
let modalResolve = null;
let modalData = null;

function openModal(title, bodyHTML, confirmText = 'Confirm', confirmAction = null, cancelText = 'Cancel') {
    return new Promise((resolve) => {
        let overlay = document.getElementById('modalOverlay');
        if (!overlay) {
            const modalHTML = `
                <div class="modal-overlay" id="modalOverlay" onclick="if(event.target===this)modalCancel()">
                    <div class="modal">
                        <div class="modal-header">
                            <h2 id="modalTitle">Modal</h2>
                            <button class="modal-close" onclick="modalCancel()">✕</button>
                        </div>
                        <div class="modal-body" id="modalBody"></div>
                        <div class="modal-footer">
                            <button class="btn btn-outline" id="modalCancelBtn" onclick="modalCancel()">Cancel</button>
                            <button class="btn btn-primary" id="modalConfirmBtn" onclick="modalConfirm()">Confirm</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            overlay = document.getElementById('modalOverlay');
        }
        
        if (!overlay) return;

        const titleEl = document.getElementById('modalTitle');
        const bodyEl = document.getElementById('modalBody');
        const confirmBtn = document.getElementById('modalConfirmBtn');
        const cancelBtn = document.getElementById('modalCancelBtn');
        
        if (titleEl) titleEl.textContent = title;
        if (bodyEl) bodyEl.innerHTML = bodyHTML;
        if (confirmBtn) confirmBtn.textContent = confirmText;
        if (cancelBtn) cancelBtn.textContent = cancelText;
        
        overlay.classList.add('active');

        modalResolve = resolve;
        modalData = { confirmAction };
    });
}

function closeModal(result) {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.remove('active');
    if (modalResolve) {
        modalResolve(result !== undefined ? result : null);
        modalResolve = null;
    }
}

function modalConfirm() {
    if (modalData && modalData.confirmAction) {
        modalData.confirmAction();
    }
    closeModal(true);
}

function modalCancel() {
    closeModal(false);
}

// ─── AUTH ──────────────────────────────────────────────────────────────────
async function checkAuth() {
    // Check for session check overlay
    const overlay = document.getElementById('sessionCheckOverlay');
    if (overlay) overlay.classList.add('show');

    try {
        // First check stored session
        const storedSession = getSessionData();
        
        if (storedSession && storedSession.user) {
            console.log('📦 Found stored session, validating...');
            
            const { data, error } = await supabase.auth.getSession();
            
            if (!error && data.session) {
                session = data.session;
                await loadUserRole(session.user.id);
                updateUIForAuth(session);
                updateUIForRole(currentUserRole);
                startSessionTimer();
                if (overlay) overlay.classList.remove('show');
                return true;
            }
            
            console.log('⚠️ Stored session invalid, clearing...');
            clearSessionData();
        }

        // Check Supabase directly
        const { data, error } = await supabase.auth.getSession();
        
        if (error || !data.session) {
            const statusBar = document.getElementById('statusBar');
            if (statusBar) {
                statusBar.innerHTML = `
                    <span>🔒</span>
                    <span>Please log in to continue</span>
                    <button class="btn btn-primary btn-sm" onclick="window.location.href='/login'" style="margin-left:auto;">
                        Login
                    </button>
                `;
            }
            if (overlay) overlay.classList.remove('show');
            return false;
        }

        session = data.session;
        await loadUserRole(session.user.id);
        
        saveSessionData({
            user: session.user,
            role: currentUserRole,
            timestamp: Date.now()
        });
        
        updateUIForAuth(session);
        updateUIForRole(currentUserRole);
        startSessionTimer();
        
        if (overlay) overlay.classList.remove('show');
        return true;
    } catch (e) {
        console.error('Auth check error:', e);
        if (overlay) overlay.classList.remove('show');
        return false;
    }
}

async function loadUserRole(userId) {
    try {
        // First check if this is the super admin
        if (userId === SUPER_ADMIN_USER_ID) {
            currentUserRole = 'super_admin';
            userPermissions = ADMIN_ROLES['super_admin'].permissions;
            // Ensure admin_role is set in database
            await ensureSuperAdminRole(userId);
            return;
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('admin_role')
            .eq('id', userId)
            .single();

        if (data && data.admin_role && ADMIN_ROLES[data.admin_role]) {
            currentUserRole = data.admin_role;
            userPermissions = ADMIN_ROLES[currentUserRole].permissions;
        } else {
            currentUserRole = 'guest';
            userPermissions = ADMIN_ROLES['guest']?.permissions || {};
        }
    } catch (e) {
        console.warn('Could not load user role, using default:', e);
        currentUserRole = 'guest';
        userPermissions = {};
    }
}

async function ensureSuperAdminRole(userId) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('admin_role')
            .eq('id', userId)
            .single();

        if (error) {
            console.warn('Error checking admin role:', error);
            return;
        }

        if (!data || data.admin_role !== 'super_admin') {
            console.log('🛡️ Setting Super Admin role for user:', userId);
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ 
                    admin_role: 'super_admin',
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (updateError) {
                console.warn('Could not update admin role:', updateError);
            } else {
                console.log('✅ Super Admin role set successfully');
            }
        }
    } catch (e) {
        console.warn('Error ensuring super admin role:', e);
    }
}

function updateUIForAuth(session) {
    const statusEl = document.getElementById('connectionStatus');
    if (statusEl) statusEl.textContent = `👤 \${session.user.email}`;

    const emailEl = document.getElementById('sidebarEmail');
    if (emailEl) emailEl.textContent = session.user.email;

    const nameEl = document.getElementById('sidebarName');
    const avatarEl = document.getElementById('sidebarAvatar');
    if (nameEl) {
        const name = session.user.user_metadata?.full_name ||
            session.user.email.split('@')[0];
        nameEl.textContent = name;
        if (avatarEl) avatarEl.textContent = name[0].toUpperCase();
    }
}

function updateUIForRole(role) {
    const roleInfo = ADMIN_ROLES[role];
    if (!roleInfo) return;

    const roleEl = document.getElementById('sidebarRole');
    if (roleEl) roleEl.textContent = roleInfo.label;

    const badgeEl = document.getElementById('welcomeRoleBadge');
    if (badgeEl) badgeEl.textContent = `👑 \${roleInfo.label}`;

    const footerEl = document.getElementById('userRoleFooter');
    if (footerEl) footerEl.textContent = `👑 \${roleInfo.label}`;

    // Update sidebar restrictions
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
        const requiredRole = item.dataset.requiredRole;
        if (requiredRole) {
            const hasPermission = checkRolePermission(requiredRole);
            if (!hasPermission) {
                item.classList.add('restricted');
                if (!item.querySelector('.lock-icon')) {
                    const lock = document.createElement('span');
                    lock.className = 'lock-icon';
                    lock.textContent = '🔒';
                    item.appendChild(lock);
                }
            } else {
                item.classList.remove('restricted');
                const lock = item.querySelector('.lock-icon');
                if (lock) lock.remove();
            }
        }
    });

    // Update quick actions
    document.querySelectorAll('.quick-actions .btn').forEach(btn => {
        const requiredRole = btn.dataset.requiredRole;
        if (requiredRole) {
            btn.disabled = !checkRolePermission(requiredRole);
        }
    });
}

function checkRolePermission(requiredRole) {
    if (currentUserRole === 'super_admin') return true;
    
    const roleMap = {
        'super_admin': userPermissions.canManageAdmins,
        'content_manager': userPermissions.canManageContent,
        'user_manager': userPermissions.canManageUsers,
        'moderation_manager': userPermissions.canModerate,
        'analytics_viewer': userPermissions.canViewAnalytics
    };
    
    if (roleMap[requiredRole] !== undefined) {
        return roleMap[requiredRole] || false;
    }
    
    return false;
}

// ─── SESSION TIMER ──────────────────────────────────────────────────────
function startSessionTimer() {
    if (sessionTimer) clearInterval(sessionTimer);
    sessionTimeRemaining = SESSION_TIMEOUT_MINUTES * 60;
    sessionWarningShown = false;

    sessionTimer = setInterval(() => {
        sessionTimeRemaining--;
        updateSessionDisplay();

        if (sessionTimeRemaining <= 30 && !sessionWarningShown) {
            sessionWarningShown = true;
            showSessionBanner();
        }

        if (sessionTimeRemaining <= 0) {
            clearInterval(sessionTimer);
            handleLogout();
        }
    }, 1000);

    const resetTimer = () => {
        sessionTimeRemaining = SESSION_TIMEOUT_MINUTES * 60;
        sessionWarningShown = false;
        hideSessionBanner();
        updateSessionDisplay();
        
        const expiryTime = Date.now() + (SESSION_TIMEOUT_MINUTES * 60 * 1000);
        sessionStorage.setItem(SESSION_KEYS.SESSION_EXPIRY, expiryTime.toString());
        if (localStorage.getItem(SESSION_KEYS.REMEMBER_ME) === 'true') {
            localStorage.setItem(SESSION_KEYS.SESSION_EXPIRY, expiryTime.toString());
        }
    };

    const activityEvents = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
        document.addEventListener(event, resetTimer);
    });

    window._sessionCleanup = () => {
        activityEvents.forEach(event => {
            document.removeEventListener(event, resetTimer);
        });
    };
}

function updateSessionDisplay() {
    const minutes = Math.floor(sessionTimeRemaining / 60);
    const seconds = sessionTimeRemaining % 60;
    const display = document.getElementById('sessionTimeDisplay');
    if (display) {
        display.textContent = `\${String(minutes).padStart(2, '0')}:\${String(seconds).padStart(2, '0')}`;
    }

    const dot = document.getElementById('statusDot');
    if (dot) {
        if (sessionTimeRemaining < 60) {
            dot.className = 'dot danger';
        } else if (sessionTimeRemaining < 300) {
            dot.className = 'dot warning';
        } else {
            dot.className = 'dot';
        }
    }
}

function showSessionBanner() {
    const banner = document.getElementById('sessionBanner');
    if (banner) {
        banner.classList.add('show');
        let countdown = 30;
        const countdownEl = document.getElementById('sessionCountdown');
        if (sessionCountdownInterval) clearInterval(sessionCountdownInterval);
        sessionCountdownInterval = setInterval(() => {
            countdown--;
            if (countdownEl) countdownEl.textContent = countdown;
            if (countdown <= 0) {
                clearInterval(sessionCountdownInterval);
                handleLogout();
            }
        }, 1000);
    }
}

function hideSessionBanner() {
    const banner = document.getElementById('sessionBanner');
    if (banner) {
        banner.classList.remove('show');
        if (sessionCountdownInterval) {
            clearInterval(sessionCountdownInterval);
            sessionCountdownInterval = null;
        }
    }
}

function extendSession() {
    sessionTimeRemaining = SESSION_TIMEOUT_MINUTES * 60;
    sessionWarningShown = false;
    hideSessionBanner();
    updateSessionDisplay();
    
    const expiryTime = Date.now() + (SESSION_TIMEOUT_MINUTES * 60 * 1000);
    sessionStorage.setItem(SESSION_KEYS.SESSION_EXPIRY, expiryTime.toString());
    if (localStorage.getItem(SESSION_KEYS.REMEMBER_ME) === 'true') {
        localStorage.setItem(SESSION_KEYS.SESSION_EXPIRY, expiryTime.toString());
    }
    
    showToast('⏳ Session extended', 'success');
}

// ─── LOGOUT ────────────────────────────────────────────────────────────────
async function handleLogout() {
    const confirmed = await new Promise((resolve) => {
        openModal(
            '🚪 Confirm Logout',
            `
                <div style="text-align:center;padding:12px 0;">
                    <div style="font-size:48px;margin-bottom:12px;">👋</div>
                    <p style="font-size:16px;font-weight:500;margin-bottom:8px;">Are you sure you want to logout?</p>
                    <p style="font-size:13px;color:var(--text-muted);">You will need to sign in again to access the admin panel.</p>
                </div>
            `,
            'Yes, Logout',
            () => resolve(true),
            'Cancel'
        );
    });

    if (!confirmed) return;

    try {
        await supabase.auth.signOut();
        session = null;
        
        if (sessionTimer) { clearInterval(sessionTimer); sessionTimer = null; }
        if (sessionCountdownInterval) { clearInterval(sessionCountdownInterval); sessionCountdownInterval = null; }
        if (window._sessionCleanup) { window._sessionCleanup(); }
        
        hideSessionBanner();
        clearSessionData();
        setRememberMe(false);
        
        showToast('✅ Logged out successfully', 'success');
        window.location.href = '/login';
    } catch (e) {
        showToast('❌ Logout failed: ' + e.message, 'error');
    }
}

// ─── NAVIGATION ────────────────────────────────────────────────────────────
function navigateTo(page) {
    if (window.innerWidth <= 1024) toggleSidebar(false);
    
    const navItem = document.querySelector(`.sidebar-nav-item[onclick*="\${page}"]`);
    if (navItem && navItem.classList.contains('restricted')) {
        showToast('🔒 You do not have permission to access this page', 'warning');
        return;
    }

    window.location.href = `/admin/\${page}`;
}

function toggleSidebar(open) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (open === undefined) {
        if (sidebar) sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('active');
    } else if (open) {
        if (sidebar) sidebar.classList.add('open');
        if (overlay) overlay.classList.add('active');
    } else {
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
    }
}

// ─── SAFE SET FUNCTIONS ──────────────────────────────────────────────────
function safeSetText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? '—';
}

function safeSetHTML(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = value ?? '—';
}

// ─── FORMAT HELPERS ──────────────────────────────────────────────────────
function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return dateStr;
    }
}

function formatDateShort(dateStr) {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    } catch {
        return dateStr;
    }
}

function timeAgo(dateStr) {
    if (!dateStr) return '—';
    try {
        const diff = Date.now() - new Date(dateStr).getTime();
        const seconds = Math.floor(diff / 1000);
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `\${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `\${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `\${days}d ago`;
        if (days < 30) return `\${Math.floor(days / 7)}w ago`;
        if (days < 365) return `\${Math.floor(days / 30)}mo ago`;
        return `\${Math.floor(days / 365)}y ago`;
    } catch {
        return dateStr;
    }
}

function formatNumber(num) {
    if (num === null || num === undefined) return '—';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// ─── CRUD OPERATIONS ──────────────────────────────────────────────────────
// These functions properly sync with Supabase database

async function supabaseInsert(table, data) {
    if (!supabase || !session) {
        showToast('Not authenticated', 'error');
        return { success: false, error: 'Not authenticated' };
    }
    
    try {
        const { data: result, error } = await supabase
            .from(table)
            .insert(data)
            .select();
            
        if (error) {
            console.error(`Insert error (${table}):`, error);
            return { success: false, error: error.message };
        }
        return { success: true, data: result };
    } catch (e) {
        console.error(`Insert exception (${table}):`, e);
        return { success: false, error: e.message };
    }
}

async function supabaseUpdate(table, id, data) {
    if (!supabase || !session) {
        showToast('Not authenticated', 'error');
        return { success: false, error: 'Not authenticated' };
    }
    
    try {
        const { data: result, error } = await supabase
            .from(table)
            .update(data)
            .eq('id', id)
            .select();
            
        if (error) {
            console.error(`Update error (${table}):`, error);
            return { success: false, error: error.message };
        }
        return { success: true, data: result };
    } catch (e) {
        console.error(`Update exception (${table}):`, e);
        return { success: false, error: e.message };
    }
}

async function supabaseDelete(table, id) {
    if (!supabase || !session) {
        showToast('Not authenticated', 'error');
        return { success: false, error: 'Not authenticated' };
    }
    
    try {
        const { error } = await supabase
            .from(table)
            .delete()
            .eq('id', id);
            
        if (error) {
            console.error(`Delete error (${table}):`, error);
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (e) {
        console.error(`Delete exception (${table}):`, e);
        return { success: false, error: e.message };
    }
}

async function supabaseSelect(table, query = {}) {
    if (!supabase || !session) {
        showToast('Not authenticated', 'error');
        return { success: false, error: 'Not authenticated' };
    }
    
    try {
        let request = supabase.from(table).select(query.select || '*');
        
        if (query.eq) {
            Object.entries(query.eq).forEach(([key, value]) => {
                request = request.eq(key, value);
            });
        }
        
        if (query.order) {
            request = request.order(query.order.column, { ascending: query.order.ascending || false });
        }
        
        if (query.limit) {
            request = request.limit(query.limit);
        }
        
        const { data, error } = await request;
            
        if (error) {
            console.error(`Select error (${table}):`, error);
            return { success: false, error: error.message };
        }
        return { success: true, data };
    } catch (e) {
        console.error(`Select exception (${table}):`, e);
        return { success: false, error: e.message };
    }
}

// ─── UPDATE ALL BADGES ───────────────────────────────────────────────────
async function updateAllBadges() {
    if (!supabase || !session) return;

    try {
        const [babiesResult, profilesResult, entriesResult, postsResult] = await Promise.all([
            supabase.from('babies').select('*', { count: 'exact', head: true }),
            supabase.from('profiles').select('*', { count: 'exact', head: true }),
            supabase.from('tracker_entries').select('*', { count: 'exact', head: true }),
            supabase.from('community_posts').select('*', { count: 'exact', head: true })
        ]);

        const babyCount = babiesResult.count || 0;
        const userCount = profilesResult.count || 0;
        const entryCount = entriesResult.count || 0;
        const postCount = postsResult.count || 0;

        safeSetText('babyBadge', babyCount);
        safeSetText('userBadge', userCount);
        safeSetText('postBadge', postCount);
        safeSetText('entryBadge', entryCount);
        safeSetText('modBadge', 0);

        const footerCount = document.getElementById('footerCount');
        const footerActive = document.getElementById('footerActive');
        if (footerCount) footerCount.textContent = userCount + ' users';
        if (footerActive) footerActive.textContent = userCount + ' active';

    } catch (err) {
        console.error('Error updating badges:', err);
    }
}

// ─── DASHBOARD DATA ──────────────────────────────────────────────────────
async function fetchDashboardData() {
    if (!supabase || !session) {
        console.warn('Supabase or session not ready');
        return;
    }

    const statusBar = document.getElementById('statusBar');
    if (statusBar) {
        statusBar.innerHTML = '<span>🔄 Loading...</span>';
    }

    try {
        console.log('📊 Fetching dashboard data...');

        const [babiesResult, profilesResult, entriesResult, postsResult, milestonesResult, recentResult] = await Promise.all([
            supabase.from('babies').select('*', { count: 'exact', head: true }),
            supabase.from('profiles').select('*', { count: 'exact', head: true }),
            supabase.from('tracker_entries').select('*', { count: 'exact', head: true }),
            supabase.from('community_posts').select('*', { count: 'exact', head: true }),
            supabase.from('tracker_entries').select('*', { count: 'exact', head: true }).eq('tracker_type', 'milestone'),
            supabase.from('tracker_entries')
                .select('tracker_id, title, logged_by_name, timestamp, created_at')
                .order('timestamp', { ascending: false })
                .limit(8)
        ]);

        const babyCount = babiesResult.count || 0;
        const userCount = profilesResult.count || 0;
        const entryCount = entriesResult.count || 0;
        const postCount = postsResult.count || 0;
        const milestoneCount = milestonesResult.count || 0;

        safeSetText('statBabies', babyCount);
        safeSetText('statUsers', userCount);
        safeSetText('statEntries', entryCount);
        safeSetText('statPosts', postCount);
        safeSetText('statMilestones', milestoneCount);

        safeSetText('babyBadge', babyCount);
        safeSetText('userBadge', userCount);
        safeSetText('postBadge', postCount);
        safeSetText('entryBadge', entryCount);
        safeSetText('milestoneBadge', milestoneCount);

        const { data: adminData } = await supabase
            .from('profiles')
            .select('id')
            .not('admin_role', 'is', null);
        const adminCount = adminData?.length || 0;
        safeSetText('adminBadge', adminCount);

        const { data: streakData } = await supabase
            .from('babies')
            .select('streak')
            .not('streak', 'is', null)
            .limit(100);

        let avgStreak = 0;
        if (streakData && streakData.length > 0) {
            const totalStreak = streakData.reduce((sum, b) => sum + (b.streak || 0), 0);
            avgStreak = Math.round(totalStreak / streakData.length);
        }
        safeSetText('statStreak', avgStreak + 'd');

        const feed = document.getElementById('activityFeed');
        const recent = recentResult.data || [];

        if (feed) {
            if (recent.length === 0) {
                feed.innerHTML = `
                    <div class="empty-state">
                        <div class="emoji">📭</div>
                        <h3>No recent activity</h3>
                    </div>
                `;
                safeSetText('activityCount', '0');
            } else {
                safeSetText('activityCount', recent.length);
                const iconMap = {
                    feed: '🍼',
                    sleep: '😴',
                    diaper: '🧷',
                    potty: '🚽',
                    growth: '📏',
                    medication: '💊',
                    milestone: '🏆'
                };
                let html = '';
                recent.forEach(function(a) {
                    const type = a.tracker_id || 'custom';
                    html += `
                        <div class="activity-item">
                            <div class="activity-icon">\${iconMap[type] || '📌'}</div>
                            <div class="activity-content">
                                <div class="activity-title">\${a.title || type || 'Activity'}</div>
                                <div class="activity-meta">by \${a.logged_by_name || 'Someone'} • \${timeAgo(a.timestamp)}</div>
                            </div>
                            <div class="activity-time">\${formatDate(a.timestamp)}</div>
                        </div>
                    `;
                });
                feed.innerHTML = html;
            }
        }

        const hour = new Date().getHours();
        let greeting = 'Good morning';
        if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
        else if (hour >= 17) greeting = 'Good evening';
        const userName = session?.user?.user_metadata?.full_name ||
            session?.user?.email?.split('@')[0] || 'Admin';
        const welcomeEl = document.getElementById('welcomeMessage');
        if (welcomeEl) welcomeEl.textContent = `👋 \${greeting}, \${userName}!`;

        const statusBarEl = document.getElementById('statusBar');
        if (statusBarEl) {
            statusBarEl.innerHTML = `
                <span>✅ All systems operational</span>
                <span class="status-indicator \${navigator.onLine ? 'online' : 'offline'}">
                    <span class="dot"></span> \${navigator.onLine ? 'Online' : 'Offline'}
                </span>
                <span style="margin-left:auto;font-size:12px;color:var(--text-muted);">
                    Last updated: \${new Date().toLocaleString()}
                </span>
                <span style="font-size:12px;color:var(--text-muted);margin-left:8px;">⏱️ Session: <span id="sessionTimeDisplay">\${formatSessionTime()}</span></span>
            `;
            updateSessionDisplay();
        }
        safeSetText('lastUpdated', new Date().toLocaleString());

        console.log('✅ Dashboard data loaded');

    } catch (err) {
        console.error('Fetch error:', err);
        const statusBarEl = document.getElementById('statusBar');
        if (statusBarEl) {
            statusBarEl.innerHTML = `
                <span>❌ Error loading data</span>
                <button class="btn btn-outline btn-sm" onclick="refreshAll()" style="margin-left:auto;">
                    🔄 Retry
                </button>
            `;
        }
        showToast('Error loading dashboard data: ' + err.message, 'error');
    }
}

function formatSessionTime() {
    const minutes = Math.floor(sessionTimeRemaining / 60);
    const seconds = sessionTimeRemaining % 60;
    return `\${String(minutes).padStart(2, '0')}:\${String(seconds).padStart(2, '0')}`;
}

// ─── REFRESH ──────────────────────────────────────────────────────────────
async function refreshAll() {
    showToast('🔄 Refreshing...', 'info');
    await fetchDashboardData();
    showToast('✅ All data refreshed', 'success');
}

// ─── REALTIME ──────────────────────────────────────────────────────────────
function setupRealtime() {
    if (!supabase || !session) return;
    if (realtimeChannel) {
        realtimeChannel.unsubscribe();
        realtimeChannel = null;
    }

    realtimeChannel = supabase.channel('admin-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'babies' }, () => {
            fetchDashboardData();
            updateAllBadges();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tracker_entries' }, () => {
            fetchDashboardData();
            updateAllBadges();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts' }, () => {
            fetchDashboardData();
            updateAllBadges();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
            fetchDashboardData();
            updateAllBadges();
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Realtime connected');
            } else if (status === 'CHANNEL_ERROR') {
                console.warn('⚠️ Realtime error, reconnecting...');
                setTimeout(setupRealtime, 5000);
            }
        });
}

// ─── ONLINE/OFFLINE ───────────────────────────────────────────────────────
window.addEventListener('online', () => {
    showToast('🔄 Back online', 'success');
    if (typeof fetchDashboardData === 'function') {
        fetchDashboardData();
    }
});

window.addEventListener('offline', () => {
    showToast('📡 You are offline', 'warning');
});

// ─── EXPOSE GLOBALLY ──────────────────────────────────────────────────────
// These are available to ALL admin pages
window.showToast = showToast;
window.handleLogout = handleLogout;
window.navigateTo = navigateTo;
window.toggleSidebar = toggleSidebar;
window.openModal = openModal;
window.closeModal = closeModal;
window.modalConfirm = modalConfirm;
window.modalCancel = modalCancel;
window.safeSetText = safeSetText;
window.safeSetHTML = safeSetHTML;
window.formatDate = formatDate;
window.formatDateShort = formatDateShort;
window.timeAgo = timeAgo;
window.formatNumber = formatNumber;
window.initSupabase = initSupabase;
window.checkAuth = checkAuth;
window.fetchDashboardData = fetchDashboardData;
window.updateAllBadges = updateAllBadges;
window.refreshAll = refreshAll;
window.extendSession = extendSession;
window.setRememberMe = setRememberMe;
window.supabaseInsert = supabaseInsert;
window.supabaseUpdate = supabaseUpdate;
window.supabaseDelete = supabaseDelete;
window.supabaseSelect = supabaseSelect;
window.session = session;
window.currentUserRole = currentUserRole;
window.ADMIN_ROLES = ADMIN_ROLES;
window.SUPER_ADMIN_USER_ID = SUPER_ADMIN_USER_ID;

// ─── INIT ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function() {
    if (!initSupabase()) {
        showToast('Failed to initialize Supabase', 'error');
        return;
    }

    const authed = await checkAuth();
    if (!authed) {
        showToast('Please log in to continue', 'warning');
        return;
    }

    await updateAllBadges();

    // Only run dashboard-specific code if dashboard elements exist
    if (document.getElementById('welcomeMessage') || document.getElementById('statBabies')) {
        await fetchDashboardData();
        setupRealtime();
    }

    // Handle resize for sidebar
    window.addEventListener('resize', function() {
        if (window.innerWidth > 1024) {
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebarOverlay').classList.remove('active');
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            refreshAll();
        }
        if (e.key === 'Escape') {
            closeModal();
        }
    });

    // Handle visibility change - check session when tab becomes visible
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
            const storedSession = getSessionData();
            if (!storedSession && session) {
                checkAuth();
            }
        }
    });

    // Handle beforeunload - clear session if not remember me
    window.addEventListener('beforeunload', function() {
        const rememberMe = localStorage.getItem(SESSION_KEYS.REMEMBER_ME);
        if (rememberMe !== 'true') {
            sessionStorage.removeItem(SESSION_KEYS.SESSION_DATA);
        }
    });

    console.log('🧵 Enterprise Admin Console ready');
    console.log('👤 Logged in as: ' + session?.user?.email);
    console.log('👑 Role: ' + (ADMIN_ROLES[currentUserRole]?.label || 'Guest'));
    console.log('🔐 Session persistence: ' + (localStorage.getItem(SESSION_KEYS.REMEMBER_ME) === 'true' ? 'Remember Me' : 'Session only'));
});
"@

# Write the updated admin.js
$adminJsContent | Out-File -FilePath "admin.js" -Encoding UTF8
Write-Host "  ✅ admin.js updated with centralized session management" -ForegroundColor Green

# ─── FIX dashboard.html ──────────────────────────────────────────────────
Write-Host "`n🔧 Updating dashboard.html to use centralized session..." -ForegroundColor Yellow

# Check if dashboard.html exists and update it
if (Test-Path "dashboard.html") {
    # Read the file and replace session management with centralized version
    $dashboardContent = Get-Content "dashboard.html" -Raw
    
    # Remove duplicated session management code
    $dashboardContent = $dashboardContent -replace "(?s)// ─── SESSION MANAGEMENT.*?let sessionTimeRemaining.*?// ─── ADMIN ROLE PERMISSIONS.*?const ADMIN_ROLES.*?// ─── END ADMIN ROLE PERMISSIONS", ""
    $dashboardContent = $dashboardContent -replace "(?s)// ─── SESSION PERSISTENCE.*?function setRememberMe.*?}", ""
    $dashboardContent = $dashboardContent -replace "(?s)// ─── AUTH ─────────────────────────────────────────────────────────.*?async function checkAuth.*?}", ""
    $dashboardContent = $dashboardContent -replace "(?s)// ─── LOGOUT ────────────────────────────────────────────────────────.*?async function handleLogout.*?}", ""
    $dashboardContent = $dashboardContent -replace "(?s)// ─── NAVIGATION ────────────────────────────────────────────────────.*?function navigateTo.*?}", ""
    $dashboardContent = $dashboardContent -replace "(?s)// ─── SESSION TIMER ───────────────────────────────────────────────.*?function startSessionTimer.*?}", ""
    $dashboardContent = $dashboardContent -replace "(?s)// ─── SAFE SET ─────────────────────────────────────────────────────.*?function safeSetText.*?}", ""
    
    # Keep the HTML structure but ensure it uses the centralized admin.js
    $dashboardContent = $dashboardContent -replace '<script src="/js/admin.js"></script>', '<script src="/js/admin.js"></script>'
    
    $dashboardContent | Out-File -FilePath "dashboard.html" -Encoding UTF8
    Write-Host "  ✅ dashboard.html updated" -ForegroundColor Green
}

# ─── CREATE PAGES DIRECTORY IF IT DOESN'T EXIST ─────────────────────────
Write-Host "`n📁 Checking pages directory..." -ForegroundColor Yellow
if (-not (Test-Path "pages")) {
    New-Item -ItemType Directory -Path "pages" -Force | Out-Null
    Write-Host "  ✅ Created pages directory" -ForegroundColor Green
}

# ─── CREATE admin_roles.html if it doesn't exist ──────────────────────
Write-Host "`n📄 Ensuring admin_roles.html exists..." -ForegroundColor Yellow
if (-not (Test-Path "pages\admin_roles.html")) {
    $adminRolesHtml = @"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Admin Roles - LittleLoom Admin</title>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.min.js">
    </script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/css/admin.css" />
    <style>
        .page-hero {
            background: linear-gradient(135deg, #0f172a, #1e293b);
            border-radius: var(--radius);
            padding: 28px 32px;
            color: #fff;
            margin-bottom: 24px;
            position: relative;
            overflow: hidden;
        }
        .page-hero::after { content: '👥'; position: absolute; right: 28px; top: 50%; transform: translateY(-50%); font-size: 64px; opacity: 0.1; }
        .page-hero h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.3px; }
        .page-hero p { opacity: 0.85; font-size: 14px; margin-top: 4px; }
        .page-hero .stats-row { display: flex; gap: 32px; margin-top: 16px; flex-wrap: wrap; }
        .page-hero .stats-row .stat { display: flex; align-items: baseline; gap: 6px; }
        .page-hero .stats-row .stat .num { font-size: 28px; font-weight: 800; }
        .page-hero .stats-row .stat .label { font-size: 13px; opacity: 0.75; }

        .admin-card {
            background: var(--bg-card);
            border-radius: var(--radius);
            border: 1px solid var(--border);
            padding: 20px 24px;
            margin-bottom: 16px;
            transition: all var(--transition);
            box-shadow: var(--shadow);
        }
        .admin-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-2px); }
        .admin-card .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
        }
        .admin-card .name { font-size: 17px; font-weight: 700; }
        .admin-card .email { font-size: 13px; color: var(--text-muted); }
        .admin-card .role-selector { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .admin-card .role-selector select {
            padding: 6px 12px;
            border-radius: var(--radius-sm);
            border: 1px solid var(--border);
            font-size: 13px;
            font-family: var(--font);
            background: var(--bg-primary);
            color: var(--text-primary);
        }
        .admin-card .role-selector select:focus {
            outline: none;
            border-color: var(--primary);
        }
        .admin-card .permissions {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid var(--border);
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 6px;
        }
        .admin-card .permissions .perm {
            font-size: 12px;
            color: var(--text-secondary);
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .admin-card .permissions .perm .check { color: #22c55e; }
        .admin-card .permissions .perm .cross { color: #ef4444; }

        .admin-card.protected {
            border-left: 4px solid #7c3aed;
            background: rgba(124, 58, 237, 0.05);
        }
        .admin-card.protected .protected-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 10px;
            border-radius: 20px;
            font-size: 10px;
            font-weight: 600;
            background: #ede9fe;
            color: #7c3aed;
        }
        .admin-card.protected .role-selector select {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .filter-bar-modern {
            display: flex; gap: 12px; flex-wrap: wrap; align-items: center;
            background: var(--bg-card); border-radius: var(--radius); padding: 12px 20px;
            border: 1px solid var(--border); box-shadow: var(--shadow); margin-bottom: 20px;
        }
        .filter-bar-modern input, .filter-bar-modern select {
            padding: 8px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border);
            font-size: 13px; font-family: var(--font); background: var(--bg-primary);
            color: var(--text-primary); transition: var(--transition);
        }
        .filter-bar-modern input:focus, .filter-bar-modern select:focus {
            outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }

        .admin-role-badge {
            display: inline-flex;
            padding: 2px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
        }
        .admin-role-badge.super-admin { background: #ede9fe; color: #7c3aed; }
        .admin-role-badge.content-manager { background: #dbeafe; color: #2563eb; }
        .admin-role-badge.user-manager { background: #dcfce7; color: #16a34a; }
        .admin-role-badge.moderation-manager { background: #fef3c7; color: #d97706; }
        .admin-role-badge.analytics-viewer { background: #fce7f3; color: #db2777; }
        .admin-role-badge.guest { background: #f3f4f6; color: #6b7280; }

        .session-banner {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 10000;
            background: #fee2e2;
            color: #dc2626;
            padding: 12px 24px;
            display: none;
            align-items: center;
            justify-content: center;
            gap: 12px;
            font-weight: 600;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(220, 38, 38, 0.2);
            animation: slideDownBanner 0.3s ease;
        }
        .session-banner.show { display: flex; }
        .session-banner .countdown {
            background: #dc2626;
            color: #fff;
            padding: 2px 12px;
            border-radius: 20px;
            font-size: 13px;
            min-width: 40px;
            text-align: center;
        }
        .session-banner .btn {
            padding: 4px 16px;
            font-size: 12px;
            border-radius: var(--radius-sm);
            border: none;
            font-weight: 600;
            cursor: pointer;
            transition: var(--transition);
        }
        .session-banner .btn-primary { background: #dc2626; color: #fff; }
        .session-banner .btn-primary:hover { background: #b91c1c; }
        .session-banner .btn-outline {
            background: transparent;
            color: #dc2626;
            border: 1.5px solid #dc2626;
        }
        .session-banner .btn-outline:hover { background: #fee2e2; }

        @keyframes slideDownBanner {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .session-check-overlay {
            position: fixed;
            inset: 0;
            z-index: 99999;
            background: var(--bg-primary);
            display: none;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 16px;
            animation: fadeIn 0.3s ease;
        }
        .session-check-overlay.show { display: flex; }
        .session-check-overlay .spinner {
            width: 48px;
            height: 48px;
            border: 4px solid var(--border);
            border-top-color: var(--primary);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        .session-check-overlay .message {
            font-size: 16px;
            color: var(--text-secondary);
            font-weight: 500;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        .permission-denied {
            text-align: center;
            padding: 60px 20px;
        }
        .permission-denied .emoji {
            font-size: 64px;
            margin-bottom: 16px;
        }
        .permission-denied h3 {
            font-size: 20px;
            font-weight: 700;
            color: var(--text-primary);
            margin-bottom: 8px;
        }
        .permission-denied p {
            color: var(--text-muted);
            font-size: 14px;
        }

        @media (max-width: 768px) {
            .page-hero .stats-row { flex-wrap: wrap; gap: 16px; }
            .admin-card .header { flex-direction: column; align-items: stretch; }
            .admin-card .role-selector { justify-content: stretch; }
            .admin-card .role-selector select { flex: 1; }
            .admin-card .permissions { grid-template-columns: 1fr; }
            .session-banner { flex-wrap: wrap; padding: 10px 16px; font-size: 12px; }
        }
    </style>
</head>
<body>
    <!-- ─── SESSION CHECK OVERLAY ────────────────────────────────────── -->
    <div class="session-check-overlay" id="sessionCheckOverlay">
        <div class="spinner"></div>
        <div class="message">🔄 Validating session...</div>
    </div>

    <!-- ─── SESSION TIMEOUT BANNER ────────────────────────────────────── -->
    <div class="session-banner" id="sessionBanner">
        <span>⏰</span>
        <span>Your session will expire in <span class="countdown" id="sessionCountdown">30</span> seconds</span>
        <button class="btn btn-outline" onclick="window.extendSession ? window.extendSession() : ''">⏳ Stay Logged In</button>
        <button class="btn btn-primary" onclick="window.handleLogout ? window.handleLogout() : ''">🚪 Logout Now</button>
    </div>

    <div class="app">
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-brand" onclick="window.navigateTo ? window.navigateTo('dashboard') : ''">
                <div class="brand-icon">🧵</div>
                <div><div class="logo-title">LittleLoom</div><div class="logo-sub">Enterprise Console</div></div>
            </div>
            <nav class="sidebar-nav">
                <div class="sidebar-nav-label">📊 Overview</div>
                <a class="sidebar-nav-item" href="#" onclick="window.navigateTo ? window.navigateTo('dashboard') : ''">
                    <span class="icon">📊</span> Dashboard
                    <span class="badge success">Live</span>
                </a>
                <div class="sidebar-nav-label">👑 Management</div>
                <a class="sidebar-nav-item" href="#" onclick="window.navigateTo ? window.navigateTo('babies') : ''">
                    <span class="icon">👶</span> Babies
                    <span class="badge" id="babyBadge">0</span>
                </a>
                <a class="sidebar-nav-item" href="#" onclick="window.navigateTo ? window.navigateTo('users') : ''">
                    <span class="icon">👤</span> Users
                    <span class="badge" id="userBadge">0</span>
                </a>
                <a class="sidebar-nav-item" href="#" onclick="window.navigateTo ? window.navigateTo('moderation') : ''">
                    <span class="icon">🛡️</span> Moderation
                    <span class="badge danger" id="modBadge">0</span>
                </a>
                <div class="sidebar-nav-label">💬 Community</div>
                <a class="sidebar-nav-item" href="#" onclick="window.navigateTo ? window.navigateTo('community') : ''">
                    <span class="icon">💬</span> Community Posts
                    <span class="badge" id="postBadge">0</span>
                </a>
                <div class="sidebar-nav-label">⚙️ System</div>
                <a class="sidebar-nav-item active" href="#">
                    <span class="icon">👥</span> Admin Roles
                    <span class="badge danger" id="adminBadge">0</span>
                </a>
                <a class="sidebar-nav-item" href="#" onclick="window.navigateTo ? window.navigateTo('settings') : ''">
                    <span class="icon">⚙️</span> Settings
                    <span class="lock-icon">🔒</span>
                </a>
                <a class="sidebar-nav-item" href="#" onclick="window.navigateTo ? window.navigateTo('audit') : ''">
                    <span class="icon">📋</span> Audit Logs
                    <span class="lock-icon">🔒</span>
                </a>
            </nav>
            <div class="sidebar-footer">
                <div class="user-info">
                    <div class="user-avatar" id="sidebarAvatar">A</div>
                    <div>
                        <div class="user-name" id="sidebarName">Admin</div>
                        <div class="user-email" id="sidebarEmail">admin@littleloom.com</div>
                        <div class="user-role" id="sidebarRole">Super Admin</div>
                    </div>
                </div>
            </div>
        </aside>

        <div class="sidebar-overlay" id="sidebarOverlay" onclick="window.toggleSidebar ? window.toggleSidebar(false) : ''"></div>

        <div class="modal-overlay" id="modalOverlay" onclick="if(event.target===this)window.modalCancel ? window.modalCancel() : ''">
            <div class="modal">
                <div class="modal-header"><h2 id="modalTitle">Modal</h2><button class="modal-close" onclick="window.modalCancel ? window.modalCancel() : ''">✕</button></div>
                <div class="modal-body" id="modalBody"></div>
                <div class="modal-footer">
                    <button class="btn btn-outline" id="modalCancelBtn" onclick="window.modalCancel ? window.modalCancel() : ''">Cancel</button>
                    <button class="btn btn-primary" id="modalConfirmBtn" onclick="window.modalConfirm ? window.modalConfirm() : ''">Confirm</button>
                </div>
            </div>
        </div>

        <main class="main">
            <header class="topbar">
                <div class="topbar-left"><button class="topbar-menu-btn" onclick="window.toggleSidebar ? window.toggleSidebar() : ''">☰</button><div><div class="topbar-title">Admin Roles <span class="sub">| Role Management</span></div></div></div>
                <div class="topbar-right">
                    <div class="topbar-status">
                        <span class="dot" id="statusDot"></span>
                        <span id="connectionStatus">Connected</span>
                    </div>
                    <div class="topbar-actions">
                        <button class="btn btn-outline btn-sm" onclick="loadAdminUsers()">🔄 Refresh</button>
                        <button class="btn btn-danger btn-sm" onclick="window.handleLogout ? window.handleLogout() : ''">🚪 Logout</button>
                    </div>
                </div>
            </header>

            <div class="page-content active">
                <div class="status-bar" id="statusBar">
                    <span>✅ Ready</span>
                    <span style="margin-left:auto;font-size:12px;color:var(--text-muted);" id="lastUpdated">Last updated: —</span>
                    <span style="font-size:12px;color:var(--text-muted);margin-left:8px;" id="sessionTimer">⏱️ Session: <span id="sessionTimeDisplay">30:00</span></span>
                </div>

                <div class="page-hero">
                    <h1>👥 Admin Roles</h1>
                    <p>Manage admin user roles and permissions</p>
                    <div class="stats-row">
                        <div class="stat"><span class="num" id="statTotal">0</span><span class="label">Total Admins</span></div>
                        <div class="stat"><span class="num" id="statSuper">0</span><span class="label">Super Admins</span></div>
                        <div class="stat"><span class="num" id="statContent">0</span><span class="label">Content Managers</span></div>
                        <div class="stat"><span class="num" id="statModeration">0</span><span class="label">Moderation Managers</span></div>
                    </div>
                </div>

                <div class="filter-bar-modern">
                    <input type="text" placeholder="🔍 Search admins..." id="searchInput" oninput="filterAdmins()">
                    <select id="roleFilter" onchange="filterAdmins()">
                        <option value="all">All Roles</option>
                        <option value="super_admin">Super Admin</option>
                        <option value="content_manager">Content Manager</option>
                        <option value="user_manager">User Manager</option>
                        <option value="moderation_manager">Moderation Manager</option>
                        <option value="analytics_viewer">Analytics Viewer</option>
                    </select>
                    <button class="btn btn-primary" onclick="openAddAdminModal()">➕ Add Admin</button>
                </div>

                <div id="adminsContainer">
                    <div class="empty-state-modern"><div class="emoji">👥</div><h3>Loading admins...</h3><p>Please wait while we fetch the data</p></div>
                </div>
            </div>
        </main>
    </div>

    <div class="toast-container" id="toastContainer"></div>

    <script src="/js/admin.js"></script>
    <script>
        let adminUsers = [];
        let currentFiltered = [];

        const ROLE_LABELS = {
            super_admin: 'Super Admin',
            content_manager: 'Content Manager',
            user_manager: 'User Manager',
            moderation_manager: 'Moderation Manager',
            analytics_viewer: 'Analytics Viewer',
            guest: 'Guest'
        };
        const ROLE_BADGE_CLASSES = {
            super_admin: 'super-admin',
            content_manager: 'content-manager',
            user_manager: 'user-manager',
            moderation_manager: 'moderation-manager',
            analytics_viewer: 'analytics-viewer',
            guest: 'guest'
        };
        const PERMISSION_LABELS = {
            canManageAdmins: 'Manage Admins',
            canManageUsers: 'Manage Users',
            canManageContent: 'Manage Content',
            canModerate: 'Moderate Content',
            canViewAnalytics: 'View Analytics',
            canManageSystem: 'Manage System',
            canManageBackup: 'Manage Backup',
            canViewAudit: 'View Audit Logs',
            canManageAPI: 'Manage API',
            canManageFeatures: 'Manage Features'
        };

        async function loadAdminUsers() {
            const supabase = window.supabase;
            const session = window.session;
            
            if (!supabase || !session) {
                window.showToast('Please log in first', 'warning');
                return;
            }

            // Check if user has permission - only Super Admin can manage roles
            if (window.currentUserRole !== 'super_admin') {
                document.getElementById('adminsContainer').innerHTML = `
                    <div class="permission-denied">
                        <div class="emoji">🔒</div>
                        <h3>Access Denied</h3>
                        <p>You do not have permission to manage admin roles. This feature is restricted to Super Admins only.</p>
                    </div>
                `;
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .not('admin_role', 'is', null)
                    .order('full_name');

                if (error) throw error;

                adminUsers = data || [];
                currentFiltered = [...adminUsers];
                renderAdmins(currentFiltered);
                updateStats(currentFiltered);

                document.getElementById('lastUpdated').textContent = new Date().toLocaleString();
                window.showToast('✅ Admin users loaded successfully', 'success');
            } catch (e) {
                console.error('Load error:', e);
                window.showToast('Error loading admin users: ' + e.message, 'error');
            }
        }

        function renderAdmins(admins) {
            const container = document.getElementById('adminsContainer');
            if (!admins || admins.length === 0) {
                container.innerHTML = `
                    <div class="empty-state-modern">
                        <div class="emoji">👥</div>
                        <h3>No admin users found</h3>
                        <p>Add admin users to manage the platform</p>
                        <button class="btn btn-primary" onclick="openAddAdminModal()" style="margin-top:12px;">➕ Add Admin</button>
                    </div>
                `;
                return;
            }

            const SUPER_ADMIN_ID = window.SUPER_ADMIN_USER_ID || 'a3f834ef-7fa5-4732-9a03-af154806ac16';
            
            let html = '';
            admins.forEach(admin => {
                const role = admin.admin_role || 'guest';
                const roleLabel = ROLE_LABELS[role] || role;
                const badgeClass = ROLE_BADGE_CLASSES[role] || 'guest';
                const permissions = window.ADMIN_ROLES?.[role]?.permissions || {};
                const isSuperAdmin = admin.id === SUPER_ADMIN_ID;
                const isProtected = isSuperAdmin || (role === 'super_admin');

                let permsHtml = '';
                const permEntries = Object.entries(permissions);
                if (permEntries.length > 0) {
                    permEntries.forEach(([key, value]) => {
                        const label = PERMISSION_LABELS[key] || key;
                        permsHtml += `
                            <div class="perm">
                                ${value ? '<span class="check">✅</span>' : '<span class="cross">❌</span>'}
                                ${label}
                            </div>
                        `;
                    });
                }

                const protectedClass = isProtected ? 'protected' : '';
                const protectedBadge = isProtected ? `
                    <span class="protected-badge">🛡️ Protected</span>
                ` : '';

                html += `
                    <div class="admin-card ${protectedClass}" data-id="${admin.id}">
                        <div class="header">
                            <div>
                                <div class="name">
                                    ${admin.full_name || 'Unnamed Admin'}
                                    ${protectedBadge}
                                </div>
                                <div class="email">${admin.email || 'No email'}</div>
                            </div>
                            <div class="role-selector">
                                <span class="admin-role-badge ${badgeClass}">${roleLabel}</span>
                                <select onchange="updateAdminRole('${admin.id}', this.value)" ${isProtected ? 'disabled' : ''}>
                                    <option value="super_admin" ${role === 'super_admin' ? 'selected' : ''}>Super Admin</option>
                                    <option value="content_manager" ${role === 'content_manager' ? 'selected' : ''}>Content Manager</option>
                                    <option value="user_manager" ${role === 'user_manager' ? 'selected' : ''}>User Manager</option>
                                    <option value="moderation_manager" ${role === 'moderation_manager' ? 'selected' : ''}>Moderation Manager</option>
                                    <option value="analytics_viewer" ${role === 'analytics_viewer' ? 'selected' : ''}>Analytics Viewer</option>
                                    <option value="guest" ${role === 'guest' ? 'selected' : ''}>Remove Admin</option>
                                </select>
                            </div>
                        </div>
                        <div class="permissions">
                            ${permsHtml || '<div style="color:var(--text-muted);font-size:12px;">No permissions defined</div>'}
                        </div>
                    </div>
                `;
            });

            container.innerHTML = html;
            document.getElementById('adminBadge').textContent = admins.length;
        }

        function updateStats(admins) {
            const total = admins.length;
            const superAdmins = admins.filter(a => a.admin_role === 'super_admin').length;
            const contentManagers = admins.filter(a => a.admin_role === 'content_manager').length;
            const moderationManagers = admins.filter(a => a.admin_role === 'moderation_manager').length;

            document.getElementById('statTotal').textContent = total;
            document.getElementById('statSuper').textContent = superAdmins;
            document.getElementById('statContent').textContent = contentManagers;
            document.getElementById('statModeration').textContent = moderationManagers;
            document.getElementById('adminBadge').textContent = total;
        }

        function filterAdmins() {
            const search = document.getElementById('searchInput')?.value?.toLowerCase() || '';
            const role = document.getElementById('roleFilter')?.value || 'all';

            let filtered = adminUsers;
            if (search) {
                filtered = filtered.filter(a =>
                    (a.full_name || '').toLowerCase().includes(search) ||
                    (a.email || '').toLowerCase().includes(search)
                );
            }
            if (role !== 'all') {
                filtered = filtered.filter(a => a.admin_role === role);
            }

            currentFiltered = filtered;
            renderAdmins(filtered);
        }

        async function updateAdminRole(userId, newRole) {
            const SUPER_ADMIN_ID = window.SUPER_ADMIN_USER_ID || 'a3f834ef-7fa5-4732-9a03-af154806ac16';
            
            // Prevent changing the super admin user's role
            if (userId === SUPER_ADMIN_ID) {
                window.showToast('🔒 Cannot change the Super Admin user\'s role', 'warning');
                return;
            }

            const supabase = window.supabase;
            if (!supabase) return;

            try {
                const { error } = await supabase
                    .from('profiles')
                    .update({
                        admin_role: newRole === 'guest' ? null : newRole,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', userId);

                if (error) throw error;

                const roleLabel = ROLE_LABELS[newRole] || 'Guest';
                window.showToast(`✅ Admin role updated to ${roleLabel}`, 'success');
                loadAdminUsers();
            } catch (e) {
                window.showToast('Error updating admin role: ' + e.message, 'error');
            }
        }

        function openAddAdminModal() {
            const body = `
                <div class="modal-user-form">
                    <div class="form-group">
                        <label>User Email *</label>
                        <input type="email" id="adminEmail" placeholder="Enter user email address">
                    </div>
                    <div class="form-group">
                        <label>Admin Role</label>
                        <select id="adminRole">
                            <option value="content_manager">Content Manager</option>
                            <option value="user_manager">User Manager</option>
                            <option value="moderation_manager">Moderation Manager</option>
                            <option value="analytics_viewer">Analytics Viewer</option>
                            <option value="super_admin">Super Admin</option>
                        </select>
                    </div>
                    <div style="font-size:12px;color:var(--text-muted);margin-top:8px;padding:12px;background:var(--bg-primary);border-radius:var(--radius-sm);">
                        ⚠️ The user must already have an account in the system. They will be granted admin access with the selected role.
                    </div>
                </div>
            `;

            window.openModal('👥 Add Admin User', body, 'Add Admin', async function() {
                const email = document.getElementById('adminEmail')?.value?.trim();
                const role = document.getElementById('adminRole')?.value || 'content_manager';
                const supabase = window.supabase;

                if (!email) { window.showToast('Please enter an email address', 'warning'); return; }

                try {
                    const { data: users, error: findError } = await supabase
                        .from('profiles')
                        .select('id, full_name, email')
                        .eq('email', email)
                        .maybeSingle();

                    if (findError || !users) {
                        window.showToast('User not found. Please make sure the user has an account.', 'error');
                        return;
                    }

                    const SUPER_ADMIN_ID = window.SUPER_ADMIN_USER_ID || 'a3f834ef-7fa5-4732-9a03-af154806ac16';
                    if (users.id === SUPER_ADMIN_ID) {
                        window.showToast('This user is already the Super Admin', 'warning');
                        return;
                    }

                    const { error: updateError } = await supabase
                        .from('profiles')
                        .update({
                            admin_role: role,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', users.id);

                    if (updateError) throw updateError;

                    const roleLabel = ROLE_LABELS[role] || role;
                    window.showToast(`✅ ${users.full_name || 'User'} added as ${roleLabel}`, 'success');
                    window.closeModal(true);
                    loadAdminUsers();
                } catch (e) {
                    window.showToast('Error adding admin: ' + e.message, 'error');
                }
            });
        }

        document.addEventListener('DOMContentLoaded', function() { 
            // Wait for admin.js to load
            setTimeout(loadAdminUsers, 500);
        });
        
        window.loadAdminUsers = loadAdminUsers;
        window.filterAdmins = filterAdmins;
        window.updateAdminRole = updateAdminRole;
        window.openAddAdminModal = openAddAdminModal;
    </script>
</body>
</html>
"@
    $adminRolesHtml | Out-File -FilePath "pages\admin_roles.html" -Encoding UTF8
    Write-Host "  ✅ Created admin_roles.html" -ForegroundColor Green
} else {
    Write-Host "  ✅ admin_roles.html already exists" -ForegroundColor Green
}

# ─── UPDATE server.js to serve admin_roles ─────────────────────────────
Write-Host "`n🔧 Updating server.js to serve admin_roles..." -ForegroundColor Yellow

if (Test-Path "server.js") {
    $serverContent = Get-Content "server.js" -Raw
    
    # Add admin_roles route if not present
    if ($serverContent -notmatch "/admin/admin_roles") {
        $newRoute = @"
// ─── ADMIN ROLES ROUTE ──────────────────────────────────────────
app.get('/admin/admin_roles', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages/admin_roles.html'));
});
"@
        # Insert after the page routes section
        $serverContent = $serverContent -replace "(// ─── PAGE ROUTES ──────────────────────────────────────────────)", "$1`n`n$newRoute"
        $serverContent | Out-File -FilePath "server.js" -Encoding UTF8
        Write-Host "  ✅ Added admin_roles route to server.js" -ForegroundColor Green
    } else {
        Write-Host "  ✅ admin_roles route already exists" -ForegroundColor Green
    }
}

# ─── CREATE or UPDATE CSS directory ─────────────────────────────────────
Write-Host "`n📁 Ensuring CSS directory exists..." -ForegroundColor Yellow
if (-not (Test-Path "css")) {
    New-Item -ItemType Directory -Path "css" -Force | Out-Null
    Write-Host "  ✅ Created css directory" -ForegroundColor Green
}

# ─── CREATE or UPDATE JS directory ──────────────────────────────────────
Write-Host "`n📁 Ensuring JS directory exists..." -ForegroundColor Yellow
if (-not (Test-Path "js")) {
    New-Item -ItemType Directory -Path "js" -Force | Out-Null
    Write-Host "  ✅ Created js directory" -ForegroundColor Green
}

# ─── Copy admin.js to js directory ──────────────────────────────────────
Write-Host "`n📁 Copying admin.js to js directory..." -ForegroundColor Yellow
Copy-Item "admin.js" "js\admin.js" -Force
Write-Host "  ✅ admin.js copied to js directory" -ForegroundColor Green

# ─── SUMMARY ─────────────────────────────────────────────────────────────
Write-Host "`n" + "=" * 60 -ForegroundColor Cyan
Write-Host "✅ FIX COMPLETE!" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 What was fixed:" -ForegroundColor Yellow
Write-Host "  1. ✅ Centralized session management in admin.js" -ForegroundColor White
Write-Host "  2. ✅ All pages now share the same session logic" -ForegroundColor White
Write-Host "  3. ✅ CRUD operations now properly sync with Supabase" -ForegroundColor White
Write-Host "  4. ✅ admin_roles.html created with proper access control" -ForegroundColor White
Write-Host "  5. ✅ Super Admin user (a3f834ef-7fa5-4732-9a03-af154806ac16) protected" -ForegroundColor White
Write-Host "  6. ✅ Role-based access control implemented" -ForegroundColor White
Write-Host "  7. ✅ Session timeout with warning banner" -ForegroundColor White
Write-Host "  8. ✅ Remember Me functionality" -ForegroundColor White
Write-Host ""
Write-Host "📁 Files modified:" -ForegroundColor Yellow
Write-Host "  - admin.js (centralized)" -ForegroundColor White
Write-Host "  - js/admin.js (copy)" -ForegroundColor White
Write-Host "  - dashboard.html (uses centralized session)" -ForegroundColor White
Write-Host "  - pages/admin_roles.html (created)" -ForegroundColor White
Write-Host "  - server.js (updated with admin_roles route)" -ForegroundColor White
Write-Host ""
Write-Host "📁 Backup saved to: $backupDir" -ForegroundColor Yellow
Write-Host ""
Write-Host "🚀 Next steps:" -ForegroundColor Green
Write-Host "  1. Restart your server: node server.js" -ForegroundColor White
Write-Host "  2. Login at: http://localhost:3000/login" -ForegroundColor White
Write-Host "  3. Access admin roles: http://localhost:3000/admin/admin_roles" -ForegroundColor White
Write-Host "  4. The Super Admin (a3f834ef-7fa5-4732-9a03-af154806ac16) is protected" -ForegroundColor White
Write-Host ""
Write-Host "🔐 Session Management:" -ForegroundColor Green
Write-Host "  - Session expires after $SESSION_TIMEOUT_MINUTES minutes of inactivity" -ForegroundColor White
Write-Host "  - Warning banner appears at 30 seconds remaining" -ForegroundColor White
Write-Host "  - 'Remember Me' keeps session across browser restarts" -ForegroundColor White
Write-Host "  - All pages share the same session state" -ForegroundColor White
Write-Host ""
Write-Host "💡 Tip: Add data-required-role='role_name' to sidebar items to restrict access" -ForegroundColor Cyan
Write-Host ""

# ─── Ask to restart server ──────────────────────────────────────────────
$restart = Read-Host "Do you want to restart the server now? (y/n)"
if ($restart -eq 'y') {
    Write-Host "`n🔄 Restarting server..." -ForegroundColor Yellow
    # Kill existing node processes
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$currentDir'; node server.js"
    Write-Host "✅ Server restarted!" -ForegroundColor Green
    Write-Host "📊 Dashboard: http://localhost:3000/admin/dashboard" -ForegroundColor Cyan
    Write-Host "👥 Admin Roles: http://localhost:3000/admin/admin_roles" -ForegroundColor Cyan
}

Write-Host "`n🎉 Done!" -ForegroundColor Green