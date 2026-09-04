// ─── admin.js - Centralized Session & CRUD Management ──────────────────

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────
const SUPABASE_URL = 'https://qoozrrljpgsyhxfqxnzf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RNzz7jvsGmrRp9c94JiPuA_ooZt_gmm';

let supabase = null;
let session = null;
let currentUserRole = 'guest';
let userPermissions = {};
let realtimeChannel = null;

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
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> ${message}`;
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
    const overlay = document.getElementById('sessionCheckOverlay');
    if (overlay) overlay.classList.add('show');

    try {
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
        if (userId === SUPER_ADMIN_USER_ID) {
            currentUserRole = 'super_admin';
            userPermissions = ADMIN_ROLES['super_admin'].permissions;
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
    if (statusEl) statusEl.textContent = `👤 ${session.user.email}`;

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
    if (badgeEl) badgeEl.textContent = `👑 ${roleInfo.label}`;

    const footerEl = document.getElementById('userRoleFooter');
    if (footerEl) footerEl.textContent = `👑 ${roleInfo.label}`;

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
        display.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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
    
    // Check if the user has access to this page
    const navItem = document.querySelector(`.sidebar-nav-item[onclick*="${page}"]`);
    if (navItem && navItem.classList.contains('restricted')) {
        showToast('🔒 You do not have permission to access this page', 'warning');
        return;
    }

    // Navigate to the page
    window.location.href = `/admin/${page}`;
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
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        if (days < 30) return `${Math.floor(days / 7)}w ago`;
        if (days < 365) return `${Math.floor(days / 30)}mo ago`;
        return `${Math.floor(days / 365)}y ago`;
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
                            <div class="activity-icon">${iconMap[type] || '📌'}</div>
                            <div class="activity-content">
                                <div class="activity-title">${a.title || type || 'Activity'}</div>
                                <div class="activity-meta">by ${a.logged_by_name || 'Someone'} • ${timeAgo(a.timestamp)}</div>
                            </div>
                            <div class="activity-time">${formatDate(a.timestamp)}</div>
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
        if (welcomeEl) welcomeEl.textContent = `👋 ${greeting}, ${userName}!`;

        const statusBarEl = document.getElementById('statusBar');
        if (statusBarEl) {
            statusBarEl.innerHTML = `
                <span>✅ All systems operational</span>
                <span class="status-indicator ${navigator.onLine ? 'online' : 'offline'}">
                    <span class="dot"></span> ${navigator.onLine ? 'Online' : 'Offline'}
                </span>
                <span style="margin-left:auto;font-size:12px;color:var(--text-muted);">
                    Last updated: ${new Date().toLocaleString()}
                </span>
                <span style="font-size:12px;color:var(--text-muted);margin-left:8px;">⏱️ Session: <span id="sessionTimeDisplay">${formatSessionTime()}</span></span>
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
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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

    if (document.getElementById('welcomeMessage') || document.getElementById('statBabies')) {
        await fetchDashboardData();
        setupRealtime();
    }

    window.addEventListener('resize', function() {
        if (window.innerWidth > 1024) {
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebarOverlay').classList.remove('active');
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            refreshAll();
        }
        if (e.key === 'Escape') {
            closeModal();
        }
    });

    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
            const storedSession = getSessionData();
            if (!storedSession && session) {
                checkAuth();
            }
        }
    });

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