// ─── ADMIN BASE - Shared functionality for all admin pages ──────────────

(function() {
    'use strict';

    // ─── CONFIG ──────────────────────────────────────────────────────────
    const CONFIG = {
        SUPABASE_URL: 'https://qoozrrljpgsyhxfqxnzf.supabase.co',
        SUPABASE_ANON_KEY: 'sb_publishable_RNzz7jvsGmrRp9c94JiPuA_ooZt_gmm',
        SESSION_TIMEOUT_MINUTES: 30,
        SUPER_ADMIN_USER_ID: 'a3f834ef-7fa5-4732-9a03-af154806ac16',
        SESSION_KEYS: {
            SESSION_DATA: 'littleloom_session_data',
            SESSION_EXPIRY: 'littleloom_session_expiry',
            REMEMBER_ME: 'littleloom_remember_me'
        }
    };

    // ─── STATE ──────────────────────────────────────────────────────────
    let supabase = null;
    let session = null;
    let currentUserRole = 'guest';
    let sessionTimer = null;
    let sessionTimeRemaining = 30 * 60;
    let isSessionActive = true;

    // ─── INIT SUPABASE ──────────────────────────────────────────────────
    function initSupabase() {
        try {
            supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
            window._supabaseClient = supabase;
            return true;
        } catch (e) {
            console.error('Supabase init error:', e);
            return false;
        }
    }

    // ─── SESSION FUNCTIONS ─────────────────────────────────────────────
    function getSessionData() {
        try {
            let data = sessionStorage.getItem(CONFIG.SESSION_KEYS.SESSION_DATA);
            let expiry = sessionStorage.getItem(CONFIG.SESSION_KEYS.SESSION_EXPIRY);
            if (!data) {
                data = localStorage.getItem(CONFIG.SESSION_KEYS.SESSION_DATA);
                expiry = localStorage.getItem(CONFIG.SESSION_KEYS.SESSION_EXPIRY);
            }
            if (data && expiry) {
                const expiryTime = parseInt(expiry, 10);
                if (Date.now() < expiryTime) {
                    return JSON.parse(data);
                }
                clearSessionData();
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    function clearSessionData() {
        sessionStorage.removeItem(CONFIG.SESSION_KEYS.SESSION_DATA);
        sessionStorage.removeItem(CONFIG.SESSION_KEYS.SESSION_EXPIRY);
        localStorage.removeItem(CONFIG.SESSION_KEYS.SESSION_DATA);
        localStorage.removeItem(CONFIG.SESSION_KEYS.SESSION_EXPIRY);
        localStorage.removeItem(CONFIG.SESSION_KEYS.REMEMBER_ME);
    }

    function saveSessionData(data) {
        try {
            const expiryTime = Date.now() + (CONFIG.SESSION_TIMEOUT_MINUTES * 60 * 1000);
            sessionStorage.setItem(CONFIG.SESSION_KEYS.SESSION_DATA, JSON.stringify(data));
            sessionStorage.setItem(CONFIG.SESSION_KEYS.SESSION_EXPIRY, expiryTime.toString());
            const rememberMe = localStorage.getItem(CONFIG.SESSION_KEYS.REMEMBER_ME);
            if (rememberMe === 'true') {
                localStorage.setItem(CONFIG.SESSION_KEYS.SESSION_DATA, JSON.stringify(data));
                localStorage.setItem(CONFIG.SESSION_KEYS.SESSION_EXPIRY, expiryTime.toString());
            }
        } catch (e) {
            console.warn('Could not save session data:', e);
        }
    }

    // ─── AUTH CHECK ─────────────────────────────────────────────────────
    async function checkAuth() {
        // Check if we're on login page
        if (window.location.pathname.includes('login.html') || window.location.pathname.endsWith('/login')) {
            return true;
        }

        try {
            // First check stored session
            const storedSession = getSessionData();
            if (storedSession && storedSession.user) {
                const { data, error } = await supabase.auth.getSession();
                if (!error && data.session) {
                    session = data.session;
                    currentUserRole = storedSession.role || 'super_admin';
                    window._session = session;
                    window._userRole = currentUserRole;
                    startSessionTimer();
                    updateUIForAuth(session);
                    return true;
                }
                clearSessionData();
            }

            // Try to get fresh session
            const { data, error } = await supabase.auth.getSession();
            if (error || !data.session) {
                redirectToLogin();
                return false;
            }

            session = data.session;
            await loadUserRole(session.user.id);
            saveSessionData({
                user: session.user,
                role: currentUserRole,
                timestamp: Date.now()
            });
            window._session = session;
            window._userRole = currentUserRole;
            startSessionTimer();
            updateUIForAuth(session);
            return true;

        } catch (e) {
            console.error('Auth check error:', e);
            redirectToLogin();
            return false;
        }
    }

    function redirectToLogin() {
        const currentPath = window.location.pathname;
        if (!currentPath.includes('login.html') && !currentPath.endsWith('/login')) {
            window.location.href = '/login?redirect=' + encodeURIComponent(currentPath);
        }
    }

    async function loadUserRole(userId) {
        try {
            if (userId === CONFIG.SUPER_ADMIN_USER_ID) {
                currentUserRole = 'super_admin';
                await ensureSuperAdminRole(userId);
                return;
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('admin_role')
                .eq('id', userId)
                .single();

            if (data && data.admin_role) {
                currentUserRole = data.admin_role;
            } else {
                currentUserRole = 'guest';
            }
        } catch (e) {
            console.warn('Could not load user role, using default:', e);
            currentUserRole = 'guest';
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
                    console.log('✅ Super Admin role set for user:', userId);
                }
            }
        } catch (e) {
            console.warn('Error ensuring super admin role:', e);
        }
    }

    // ─── UI UPDATE ─────────────────────────────────────────────────────
    function updateUIForAuth(session) {
        const emailEl = document.getElementById('sidebarEmail');
        const nameEl = document.getElementById('sidebarName');
        const avatarEl = document.getElementById('sidebarAvatar');
        const statusEl = document.getElementById('connectionStatus');

        if (emailEl) emailEl.textContent = session?.user?.email || 'admin@littleloom.com';
        if (nameEl) {
            const name = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Admin';
            nameEl.textContent = name;
            if (avatarEl) avatarEl.textContent = name[0].toUpperCase();
        }
        if (statusEl) statusEl.textContent = 'Connected';
    }

    // ─── SESSION TIMER ─────────────────────────────────────────────────
    function startSessionTimer() {
        if (sessionTimer) clearInterval(sessionTimer);
        sessionTimeRemaining = CONFIG.SESSION_TIMEOUT_MINUTES * 60;
        isSessionActive = true;

        sessionTimer = setInterval(() => {
            if (!isSessionActive) return;
            sessionTimeRemaining--;
            updateSessionDisplay();

            if (sessionTimeRemaining <= 0) {
                clearInterval(sessionTimer);
                handleLogout();
            }
        }, 1000);

        // Reset timer on user activity
        const resetTimer = () => {
            if (!isSessionActive) return;
            sessionTimeRemaining = CONFIG.SESSION_TIMEOUT_MINUTES * 60;
            updateSessionDisplay();
            const expiryTime = Date.now() + (CONFIG.SESSION_TIMEOUT_MINUTES * 60 * 1000);
            sessionStorage.setItem(CONFIG.SESSION_KEYS.SESSION_EXPIRY, expiryTime.toString());
            if (localStorage.getItem(CONFIG.SESSION_KEYS.REMEMBER_ME) === 'true') {
                localStorage.setItem(CONFIG.SESSION_KEYS.SESSION_EXPIRY, expiryTime.toString());
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
        const display = document.getElementById('sessionTimeDisplay');
        if (display) {
            const minutes = Math.floor(sessionTimeRemaining / 60);
            const seconds = sessionTimeRemaining % 60;
            display.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
    }

    // ─── LOGOUT ─────────────────────────────────────────────────────────
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
            isSessionActive = false;
            await supabase.auth.signOut();
            session = null;
            if (sessionTimer) { clearInterval(sessionTimer); sessionTimer = null; }
            if (window._sessionCleanup) { window._sessionCleanup(); }
            clearSessionData();
            showToast('✅ Logged out successfully', 'success');
            window.location.href = '/login';
        } catch (e) {
            showToast('❌ Logout failed: ' + e.message, 'error');
        }
    }

    // ─── TOAST ──────────────────────────────────────────────────────────
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

    // ─── MODAL ──────────────────────────────────────────────────────────
    let modalResolve = null;
    let modalData = null;

    function openModal(title, bodyHTML, confirmText = 'Confirm', confirmAction = null, cancelText = 'Cancel') {
        return new Promise((resolve) => {
            const overlay = document.getElementById('modalOverlay');
            if (!overlay) {
                console.error('Modal overlay not found');
                resolve(false);
                return;
            }

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

    // ─── NAVIGATION ─────────────────────────────────────────────────────
    function navigateTo(page) {
        if (window.innerWidth <= 1024) {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebarOverlay');
            if (sidebar) sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('active');
        }
        window.location.href = `/admin/${page}`;
    }

    function toggleSidebar(open) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (open === undefined) {
            sidebar?.classList.toggle('open');
            overlay?.classList.toggle('active');
        } else if (open) {
            sidebar?.classList.add('open');
            overlay?.classList.add('active');
        } else {
            sidebar?.classList.remove('open');
            overlay?.classList.remove('active');
        }
    }

    // ─── BUILD SIDEBAR ──────────────────────────────────────────────────
    function buildSidebar() {
        const sidebar = document.getElementById('sidebarNav');
        if (!sidebar) return;

        const currentPage = window.location.pathname.split('/').pop().replace('.html', '') || 'dashboard';

        const navItems = [
            { id: 'dashboard', icon: '📊', label: 'Dashboard', section: 'overview' },
            { id: 'babies', icon: '👶', label: 'Babies', section: 'management' },
            { id: 'users', icon: '👤', label: 'Users', section: 'management' },
            { id: 'moderation', icon: '🛡️', label: 'Moderation', section: 'management' },
            { id: 'community', icon: '💬', label: 'Community Posts', section: 'community' },
            { id: 'announcements', icon: '📢', label: 'Announcements', section: 'community' },
            { id: 'trackers', icon: '📈', label: 'Tracker Entries', section: 'trackers' },
            { id: 'milestones', icon: '🏆', label: 'Milestones', section: 'trackers' },
            { id: 'analytics', icon: '📈', label: 'Analytics', section: 'analytics' },
            { id: 'growth', icon: '📊', label: 'Growth', section: 'analytics' },
            { id: 'admin_roles', icon: '👥', label: 'Admin Roles', section: 'system' },
            { id: 'audit', icon: '📋', label: 'Audit Logs', section: 'system' },
            { id: 'backup', icon: '💾', label: 'Backup', section: 'system' },
            { id: 'settings', icon: '⚙️', label: 'Settings', section: 'system' },
            { id: 'health', icon: '❤️', label: 'Health', section: 'health' },
            { id: 'performance', icon: '⚡', label: 'Performance', section: 'health' }
        ];

        const sections = {};
        navItems.forEach(item => {
            const section = item.section || 'other';
            if (!sections[section]) sections[section] = [];
            sections[section].push(item);
        });

        const sectionLabels = {
            'overview': '📊 Overview',
            'management': '👑 Management',
            'community': '💬 Community',
            'trackers': '📊 Trackers',
            'analytics': '📈 Analytics',
            'system': '⚙️ System',
            'health': '❤️ Health'
        };

        let html = '';
        Object.keys(sections).forEach(section => {
            const items = sections[section];
            if (items.length === 0) return;

            html += `<div class="sidebar-nav-label">${sectionLabels[section] || section}</div>`;

            items.forEach(item => {
                const isActive = currentPage === item.id;
                html += `
                    <a class="sidebar-nav-item ${isActive ? 'active' : ''}"
                       href="#"
                       onclick="window._navigateTo('${item.id}')"
                       data-page="${item.id}">
                        <span class="icon">${item.icon}</span>
                        ${item.label}
                    </a>
                `;
            });
        });

        sidebar.innerHTML = html;
    }

    // ─── EXPOSE GLOBALLY ────────────────────────────────────────────────
    window._CONFIG = CONFIG;
    window._supabaseClient = null;
    window._initSupabase = initSupabase;
    window._checkAuth = checkAuth;
    window._getSession = () => session;
    window._getUserRole = () => currentUserRole;
    window._navigateTo = navigateTo;
    window._toggleSidebar = toggleSidebar;
    window._buildSidebar = buildSidebar;
    window._showToast = showToast;
    window._handleLogout = handleLogout;
    window._openModal = openModal;
    window._closeModal = closeModal;
    window._modalConfirm = modalConfirm;
    window._modalCancel = modalCancel;
    window._saveSessionData = saveSessionData;
    window._clearSessionData = clearSessionData;
    window._getSessionData = getSessionData;

    console.log('🧵 Admin Base loaded');

})();