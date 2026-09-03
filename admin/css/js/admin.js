// ─── SUPABASE CONFIG ──────────────────────────────────────────────
const SUPABASE_URL = 'https://qoozrrljpgsyhxfqxnzf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RNzz7jvsGmrRp9c94JiPuA_ooZt_gmm';

let supabase = null;
let session = null;
let refreshTimer = null;
let realtimeChannel = null;

// ─── INIT ─────────────────────────────────────────────────────────
function initSupabase() {
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return true;
    } catch (e) { 
        console.error('Supabase init error:', e); 
        return false; 
    }
}

// ─── TOAST ────────────────────────────────────────────────────────
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
    setTimeout(function() { 
        if (toast.parentNode) toast.remove(); 
    }, 4000);
}

// ─── AUTH ─────────────────────────────────────────────────────────
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
    } catch (e) { 
        console.error('Auth check error:', e); 
        return false; 
    }
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

// ─── NAVIGATION ──────────────────────────────────────────────────
function navigateTo(page) {
    window.location.href = '/admin/pages/' + page + '.html';
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

// ─── MODAL ────────────────────────────────────────────────────────
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

// ─── SAFE SET ────────────────────────────────────────────────────
function safeSetText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function safeSetHTML(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = value;
}

// ─── FORMAT HELPERS ─────────────────────────────────────────────
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

// ─── EXPOSE GLOBALLY ─────────────────────────────────────────────
window.showToast = showToast;
window.handleLogout = handleLogout;
window.navigateTo = navigateTo;
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