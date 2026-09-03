// ─── admin.js - Complete Fixed Version ──────────────────────────────────
// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────
const SUPABASE_URL = 'https://qoozrrljpgsyhxfqxnzf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RNzz7jvsGmrRp9c94JiPuA_ooZt_gmm';

let supabase = null;
let session = null;
let refreshTimer = null;
let realtimeChannel = null;
let isOnline = navigator.onLine;
let sessionTimeout = null;
const SESSION_TIMEOUT_MINUTES = 30;

// ─── INIT ──────────────────────────────────────────────────────────────────
function initSupabase() {
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return true;
    } catch (e) {
        console.error('Supabase init error:', e);
        return false;
    }
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
        const overlay = document.getElementById('modalOverlay');
        if (!overlay) return;

        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = bodyHTML;
        document.getElementById('modalConfirmBtn').textContent = confirmText;
        document.getElementById('modalCancelBtn').textContent = cancelText;
        overlay.classList.add('active');

        modalResolve = resolve;
        modalData = { confirmAction };
    });
}

function closeModal(result) {
    document.getElementById('modalOverlay').classList.remove('active');
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
    try {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) {
            const statusBar = document.getElementById('statusBar');
            if (statusBar) {
                statusBar.innerHTML = `
                    <span>🔒</span>
                    <span>Please log in to continue</span>
                    <button class="btn btn-primary btn-sm" onclick="window.location.href='/login.html'" style="margin-left:auto;">
                        Login
                    </button>
                `;
            }
            return false;
        }

        session = data.session;
        updateUIForAuth(session);
        startSessionTimeout();
        return true;
    } catch (e) {
        console.error('Auth check error:', e);
        return false;
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

// ─── SESSION TIMEOUT ──────────────────────────────────────────────────────
function startSessionTimeout() {
    if (sessionTimeout) {
        clearInterval(sessionTimeout);
        sessionTimeout = null;
    }

    sessionTimeout = setInterval(() => {
        const lastActivity = localStorage.getItem('lastActivity');
        if (lastActivity) {
            const elapsed = (Date.now() - parseInt(lastActivity)) / (1000 * 60);
            if (elapsed > SESSION_TIMEOUT_MINUTES) {
                showToast(`⏰ Session expired after ${SESSION_TIMEOUT_MINUTES} minutes`, 'warning');
                handleLogout();
            }
        }
    }, 30000);

    const updateActivity = () => {
        localStorage.setItem('lastActivity', Date.now().toString());
    };

    document.addEventListener('click', updateActivity);
    document.addEventListener('keydown', updateActivity);
    document.addEventListener('mousemove', updateActivity);
    document.addEventListener('scroll', updateActivity);
    document.addEventListener('touchstart', updateActivity);
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
        if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
        if (realtimeChannel) { realtimeChannel.unsubscribe(); realtimeChannel = null; }
        if (sessionTimeout) { clearInterval(sessionTimeout); sessionTimeout = null; }
        localStorage.removeItem('lastActivity');
        showToast('✅ Logged out successfully', 'success');
        window.location.href = '/login.html';
    } catch (e) {
        showToast('❌ Logout failed: ' + e.message, 'error');
    }
}

// ─── NAVIGATION ────────────────────────────────────────────────────────────
function navigateTo(page) {
    if (window.innerWidth <= 1024) toggleSidebar(false);
    showToast(`📂 Loading ${page}...`, 'info', 1000);
    localStorage.setItem('lastActivity', Date.now().toString());
    window.location.href = `/admin/pages/${page}.html`;
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

// ─── SAFE SET ─────────────────────────────────────────────────────────────
function safeSetText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? '—';
}

function safeSetHTML(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = value ?? '—';
}

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

// ─── ONLINE/OFFLINE ───────────────────────────────────────────────────────
window.addEventListener('online', () => {
    isOnline = true;
    showToast('🔄 Back online', 'success');
    if (typeof fetchDashboardData === 'function') {
        fetchDashboardData();
    }
});

window.addEventListener('offline', () => {
    isOnline = false;
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
window.session = session;
window.isOnline = isOnline;