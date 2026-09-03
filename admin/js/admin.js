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

// ─── PAGE LOADER ─────────────────────────────────────────────────
function loadPage(page) {
    const iframe = document.getElementById('pageFrame');
    const loading = document.getElementById('pageLoading');
    const container = document.getElementById('iframeContainer');
    
    // Update sidebar
    document.querySelectorAll('.sidebar-nav-item').forEach(el => {
        el.classList.remove('active');
        if (el.getAttribute('data-page') === page) {
            el.classList.add('active');
        }
    });
    
    // Update title
    const titles = {
        'dashboard': 'Dashboard <span class="sub">| Enterprise Overview</span>',
        'babies': 'Babies <span class="sub">| All Baby Profiles</span>',
        'users': 'Users <span class="sub">| User Management</span>',
        'moderation': 'Moderation <span class="sub">| Content Review</span>',
        'community': 'Community <span class="sub">| Posts & Engagement</span>',
        'topics': 'Topics <span class="sub">| Community Topics</span>',
        'trackers': 'Trackers <span class="sub">| All Tracker Entries</span>',
        'milestones': 'Milestones <span class="sub">| Developmental Achievements</span>',
        'analytics': 'Analytics <span class="sub">| Growth & Engagement</span>',
        'performance': 'Performance <span class="sub">| System Metrics</span>',
        'realtime': 'Realtime <span class="sub">| Live Event Stream</span>',
        'health': 'Health <span class="sub">| System Status</span>',
        'audit': 'Audit <span class="sub">| Activity Trail</span>',
        'notifications': 'Notifications <span class="sub">| Push Management</span>',
        'features': 'Feature Flags <span class="sub">| Feature Management</span>',
        'export': 'Data Export <span class="sub">| Export App Data</span>',
        'api': 'API Management <span class="sub">| Keys & Rate Limiting</span>',
        'support': 'Support <span class="sub">| Customer Support</span>',
        'announcements': 'Announcements <span class="sub">| App-wide Messages</span>',
        'settings': 'Settings <span class="sub">| System Configuration</span>',
        'backup': 'Backup <span class="sub">| Data Protection</span>'
    };
    document.getElementById('pageTitle').innerHTML = titles[page] || 'Dashboard';
    
    // Load iframe
    loading.style.display = 'flex';
    iframe.style.display = 'none';
    
    if (page === 'dashboard') {
        loading.style.display = 'none';
        iframe.style.display = 'none';
        window.location.href = '/admin/dashboard.html';
        return;
    }
    
    iframe.onload = function() {
        loading.style.display = 'none';
        iframe.style.display = 'block';
    };
    iframe.src = '/admin/pages/' + page + '.html';
    
    // Close sidebar on mobile
    if (window.innerWidth <= 768) toggleSidebar(false);
}

// ─── TABLE HELPERS ──────────────────────────────────────────────
function getTableConfig(page) {
    const configs = {
        'babies': { table: 'babies', nameField: 'name', title: 'Babies', icon: '👶' },
        'users': { table: 'profiles', nameField: 'full_name', title: 'Users', icon: '👤' },
        'moderation': { table: 'community_posts', nameField: 'title', title: 'Moderation', icon: '🛡️' },
        'community': { table: 'community_posts', nameField: 'title', title: 'Community', icon: '💬' },
        'topics': { table: 'community_topics', nameField: 'title', title: 'Topics', icon: '📌' },
        'trackers': { table: 'tracker_entries', nameField: 'title', title: 'Trackers', icon: '📈' },
        'milestones': { table: 'tracker_entries', nameField: 'title', title: 'Milestones', icon: '🏆' },
        'analytics': { table: 'babies', nameField: 'name', title: 'Analytics', icon: '📈' },
        'performance': { table: 'babies', nameField: 'name', title: 'Performance', icon: '⚡' },
        'realtime': { table: 'babies', nameField: 'name', title: 'Realtime', icon: '🔄' },
        'health': { table: 'babies', nameField: 'name', title: 'Health', icon: '❤️' },
        'audit': { table: 'babies', nameField: 'name', title: 'Audit', icon: '📋' },
        'notifications': { table: 'babies', nameField: 'name', title: 'Notifications', icon: '🔔' },
        'features': { table: 'babies', nameField: 'name', title: 'Features', icon: '🚩' },
        'export': { table: 'babies', nameField: 'name', title: 'Export', icon: '📤' },
        'api': { table: 'babies', nameField: 'name', title: 'API', icon: '🔑' },
        'support': { table: 'babies', nameField: 'name', title: 'Support', icon: '🎫' },
        'announcements': { table: 'babies', nameField: 'name', title: 'Announcements', icon: '📢' },
        'settings': { table: 'babies', nameField: 'name', title: 'Settings', icon: '⚙️' },
        'backup': { table: 'babies', nameField: 'name', title: 'Backup', icon: '💾' }
    };
    return configs[page] || configs['babies'];
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
window.loadPage = loadPage;
window.getTableConfig = getTableConfig;
window.session = session;