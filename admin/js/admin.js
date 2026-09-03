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
                    <button class="btn btn-primary btn-sm" onclick="window.location.href='/login'" style="margin-left:auto;">
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
        window.location.href = '/login';
    } catch (e) {
        showToast('❌ Logout failed: ' + e.message, 'error');
    }
}

// ─── NAVIGATION ────────────────────────────────────────────────────────────
function navigateTo(page) {
    // Close sidebar on mobile
    if (window.innerWidth <= 1024) toggleSidebar(false);
    
    // Update activity
    localStorage.setItem('lastActivity', Date.now().toString());
    
    // Navigate to the page using the clean URL format
    // This will use /admin/:page which the server handles
    window.location.href = `/admin/${page}`;
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
        document.getElementById('welcomeMessage').textContent = `👋 ${greeting}, ${userName}!`;

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
            `;
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'babies' }, () => fetchDashboardData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tracker_entries' }, () => fetchDashboardData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts' }, () => fetchDashboardData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchDashboardData())
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Realtime connected');
            } else if (status === 'CHANNEL_ERROR') {
                console.warn('⚠️ Realtime error, reconnecting...');
                setTimeout(setupRealtime, 5000);
            }
        });
}

// ─── UPDATE SIDEBAR LINKS ────────────────────────────────────────────────
function updateSidebarLinks() {
    document.querySelectorAll('.sidebar-nav-item[onclick*="navigateTo"]').forEach(el => {
        const originalOnclick = el.getAttribute('onclick');
        // The navigateTo function handles the routing now
        // No changes needed - it already uses the clean URL format
    });
}

// ─── INIT ──────────────────────────────────────────────────────────────────
async function init() {
    if (!initSupabase()) {
        showToast('Failed to initialize Supabase', 'error');
        return;
    }

    const authed = await checkAuth();
    if (!authed) {
        showToast('Please log in to continue', 'warning');
        return;
    }

    await fetchDashboardData();

    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(fetchDashboardData, 30000);

    setupRealtime();
    updateSidebarLinks();

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

    console.log('🧵 Enterprise Admin Console ready');
    console.log('👤 Logged in as: ' + session?.user?.email);
}

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
window.refreshAll = refreshAll;
window.session = session;
window.isOnline = isOnline;

document.addEventListener('DOMContentLoaded', init);