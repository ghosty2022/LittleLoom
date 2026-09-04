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
            REMEMBER_ME: 'littleloom_remember_me',
            USER_ROLE: 'littleloom_user_role',
            USER_PERMISSIONS: 'littleloom_user_permissions'
        },
        ROLES: {
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
        },
        PAGE_ROLES: {
            'dashboard': ['super_admin', 'content_manager', 'user_manager', 'moderation_manager', 'analytics_viewer'],
            'babies': ['super_admin', 'content_manager'],
            'users': ['super_admin', 'user_manager'],
            'moderation': ['super_admin', 'moderation_manager'],
            'community': ['super_admin', 'content_manager'],
            'topics': ['super_admin', 'content_manager'],
            'announcements': ['super_admin', 'content_manager'],
            'trackers': ['super_admin', 'content_manager'],
            'milestones': ['super_admin', 'content_manager'],
            'analytics': ['super_admin', 'analytics_viewer'],
            'growth': ['super_admin', 'analytics_viewer'],
            'activity': ['super_admin', 'analytics_viewer'],
            'settings': ['super_admin'],
            'backup': ['super_admin'],
            'audit': ['super_admin'],
            'admin_roles': ['super_admin'],
            'support': ['super_admin'],
            'api': ['super_admin'],
            'features': ['super_admin'],
            'export': ['super_admin', 'analytics_viewer'],
            'notifications': ['super_admin', 'content_manager', 'user_manager', 'moderation_manager', 'analytics_viewer'],
            'health': ['super_admin', 'content_manager', 'user_manager', 'moderation_manager', 'analytics_viewer'],
            'performance': ['super_admin', 'content_manager', 'user_manager', 'moderation_manager', 'analytics_viewer'],
            'qrcode': ['super_admin', 'content_manager', 'user_manager', 'moderation_manager', 'analytics_viewer'],
            'realtime': ['super_admin', 'content_manager', 'user_manager', 'moderation_manager', 'analytics_viewer']
        },
        NAV_ITEMS: [
            { id: 'dashboard', icon: '📊', label: 'Dashboard', section: 'overview' },
            { id: 'babies', icon: '👶', label: 'Babies', section: 'management', role: 'content_manager' },
            { id: 'users', icon: '👤', label: 'Users', section: 'management', role: 'user_manager' },
            { id: 'moderation', icon: '🛡️', label: 'Moderation', section: 'management', role: 'moderation_manager' },
            { id: 'community', icon: '💬', label: 'Community Posts', section: 'community', role: 'content_manager' },
            { id: 'topics', icon: '📌', label: 'Topics', section: 'community', role: 'content_manager' },
            { id: 'announcements', icon: '📢', label: 'Announcements', section: 'community', role: 'content_manager' },
            { id: 'trackers', icon: '📈', label: 'Tracker Entries', section: 'trackers', role: 'content_manager' },
            { id: 'milestones', icon: '🏆', label: 'Milestones', section: 'trackers', role: 'content_manager' },
            { id: 'analytics', icon: '📈', label: 'Analytics Dashboard', section: 'analytics', role: 'analytics_viewer' },
            { id: 'growth', icon: '📊', label: 'Growth Analytics', section: 'analytics', role: 'analytics_viewer' },
            { id: 'activity', icon: '📈', label: 'Activity Heatmap', section: 'analytics', role: 'analytics_viewer' },
            { id: 'settings', icon: '⚙️', label: 'Settings', section: 'system', role: 'super_admin' },
            { id: 'backup', icon: '💾', label: 'Backup & Restore', section: 'system', role: 'super_admin' },
            { id: 'audit', icon: '📋', label: 'Audit Logs', section: 'system', role: 'super_admin' },
            { id: 'admin_roles', icon: '👥', label: 'Admin Roles', section: 'system', role: 'super_admin' },
            { id: 'support', icon: '🎫', label: 'Support Tickets', section: 'system', role: 'super_admin' },
            { id: 'api', icon: '🔑', label: 'API Management', section: 'system', role: 'super_admin' },
            { id: 'features', icon: '🚩', label: 'Feature Flags', section: 'system', role: 'super_admin' },
            { id: 'export', icon: '📤', label: 'Data Export', section: 'tools', role: 'analytics_viewer' },
            { id: 'health', icon: '❤️', label: 'System Health', section: 'health' },
            { id: 'performance', icon: '⚡', label: 'Performance', section: 'health' },
            { id: 'qrcode', icon: '📱', label: 'QR Codes', section: 'tools' },
            { id: 'realtime', icon: '🔄', label: 'Realtime Monitor', section: 'tools' },
            { id: 'notifications', icon: '🔔', label: 'Notifications', section: 'tools' }
        ]
    };

    // ─── STATE ──────────────────────────────────────────────────────────
    let supabase = null;
    let session = null;
    let currentUserRole = 'guest';
    let userPermissions = {};
    let sessionTimer = null;
    let sessionTimeRemaining = 30 * 60;
    let sessionWarningShown = false;
    let sessionCountdownInterval = null;

    // ─── INIT SUPABASE ──────────────────────────────────────────────────
    function initSupabase() {
        try {
            supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
            window._supabaseClient = supabase;
            console.log('✅ Supabase initialized');
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
        localStorage.removeItem(CONFIG.SESSION_KEYS.USER_ROLE);
        localStorage.removeItem(CONFIG.SESSION_KEYS.USER_PERMISSIONS);
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

    function setRememberMe(value) {
        localStorage.setItem(CONFIG.SESSION_KEYS.REMEMBER_ME, value ? 'true' : 'false');
    }

    // ─── AUTH CHECK ─────────────────────────────────────────────────────
    async function checkAuth() {
        // Check if we're on login page
        if (window.location.pathname.includes('login.html') || window.location.pathname.endsWith('/login')) {
            return true;
        }

        const pageName = window.location.pathname.split('/').pop().replace('.html', '') || 'dashboard';

        try {
            // First check stored session
            const storedSession = getSessionData();
            if (storedSession && storedSession.user) {
                const { data, error } = await supabase.auth.getSession();
                if (!error && data.session) {
                    session = data.session;
                    currentUserRole = storedSession.role || 'super_admin';
                    userPermissions = storedSession.permissions || CONFIG.ROLES[currentUserRole]?.permissions || {};
                    window._session = session;
                    window._userRole = currentUserRole;
                    window._userPermissions = userPermissions;
                    startSessionTimer();
                    updateUIForAuth(session);
                    updateUIForRole(currentUserRole);
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
                permissions: userPermissions,
                timestamp: Date.now()
            });
            window._session = session;
            window._userRole = currentUserRole;
            window._userPermissions = userPermissions;
            startSessionTimer();
            updateUIForAuth(session);
            updateUIForRole(currentUserRole);

            // Check page access
            const allowedRoles = CONFIG.PAGE_ROLES[pageName] || [];
            if (allowedRoles.length > 0 && !allowedRoles.includes(currentUserRole) && currentUserRole !== 'super_admin') {
                window.location.href = '/admin/dashboard.html?error=access_denied';
                return false;
            }

            return true;

        } catch (e) {
            console.error('Auth check error:', e);
            redirectToLogin();
            return false;
        }
    }

    function redirectToLogin() {
        const currentPath = window.location.pathname;
        if (!currentPath.includes('login.html')) {
            window.location.href = '/login?redirect=' + encodeURIComponent(currentPath);
        }
    }

    async function loadUserRole(userId) {
        try {
            if (userId === CONFIG.SUPER_ADMIN_USER_ID) {
                currentUserRole = 'super_admin';
                userPermissions = CONFIG.ROLES['super_admin'].permissions;
                await ensureSuperAdminRole(userId);
                return;
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('admin_role')
                .eq('id', userId)
                .single();

            if (data && data.admin_role && CONFIG.ROLES[data.admin_role]) {
                currentUserRole = data.admin_role;
                userPermissions = CONFIG.ROLES[currentUserRole].permissions;
            } else {
                currentUserRole = 'guest';
                userPermissions = CONFIG.ROLES['guest']?.permissions || {};
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
        const roleEl = document.getElementById('sidebarRole');
        const statusEl = document.getElementById('connectionStatus');

        if (emailEl) emailEl.textContent = session?.user?.email || 'admin@littleloom.com';
        if (nameEl) {
            const name = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Admin';
            nameEl.textContent = name;
            if (avatarEl) avatarEl.textContent = name[0].toUpperCase();
        }
        if (statusEl) statusEl.textContent = `👤 ${session?.user?.email || 'Connected'}`;

        if (roleEl && CONFIG.ROLES[currentUserRole]) {
            roleEl.textContent = CONFIG.ROLES[currentUserRole].label;
        }
    }

    function updateUIForRole(role) {
        const roleInfo = CONFIG.ROLES[role];
        if (!roleInfo) return;

        const roleEl = document.getElementById('sidebarRole');
        if (roleEl) roleEl.textContent = roleInfo.label;

        // Update restricted items in sidebar
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

    // ─── SESSION TIMER ─────────────────────────────────────────────────
    function startSessionTimer() {
        if (sessionTimer) clearInterval(sessionTimer);
        sessionTimeRemaining = CONFIG.SESSION_TIMEOUT_MINUTES * 60;
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
            sessionTimeRemaining = CONFIG.SESSION_TIMEOUT_MINUTES * 60;
            sessionWarningShown = false;
            hideSessionBanner();
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

        // Store cleanup function
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
        sessionTimeRemaining = CONFIG.SESSION_TIMEOUT_MINUTES * 60;
        sessionWarningShown = false;
        hideSessionBanner();
        updateSessionDisplay();
        const expiryTime = Date.now() + (CONFIG.SESSION_TIMEOUT_MINUTES * 60 * 1000);
        sessionStorage.setItem(CONFIG.SESSION_KEYS.SESSION_EXPIRY, expiryTime.toString());
        if (localStorage.getItem(CONFIG.SESSION_KEYS.REMEMBER_ME) === 'true') {
            localStorage.setItem(CONFIG.SESSION_KEYS.SESSION_EXPIRY, expiryTime.toString());
        }
        showToast('⏳ Session extended', 'success');
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

        const allowedRoles = CONFIG.PAGE_ROLES[page] || [];
        if (allowedRoles.length > 0 && !allowedRoles.includes(currentUserRole) && currentUserRole !== 'super_admin') {
            showToast('🔒 You do not have permission to access this page', 'warning');
            return;
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
        const navItems = CONFIG.NAV_ITEMS;

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
            'health': '❤️ Health',
            'tools': '🛠️ Tools',
            'other': '📋 Other'
        };

        let html = '';
        Object.keys(sections).forEach(section => {
            const items = sections[section];
            if (items.length === 0) return;

            html += `<div class="sidebar-nav-label">${sectionLabels[section] || section}</div>`;

            items.forEach(item => {
                const isActive = currentPage === item.id;
                const isRestricted = item.role && currentUserRole !== 'super_admin' && currentUserRole !== item.role;
                const lockIcon = isRestricted ? '<span class="lock-icon">🔒</span>' : '';

                html += `
                    <a class="sidebar-nav-item ${isActive ? 'active' : ''} ${isRestricted ? 'restricted' : ''}"
                       href="#"
                       onclick="window._navigateTo('${item.id}')"
                       data-page="${item.id}"
                       data-required-role="${item.role || ''}">
                        <span class="icon">${item.icon}</span>
                        ${item.label}
                        ${lockIcon}
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
    window._getPermissions = () => userPermissions;
    window._navigateTo = navigateTo;
    window._toggleSidebar = toggleSidebar;
    window._buildSidebar = buildSidebar;
    window._showToast = showToast;
    window._handleLogout = handleLogout;
    window._extendSession = extendSession;
    window._openModal = openModal;
    window._closeModal = closeModal;
    window._modalConfirm = modalConfirm;
    window._modalCancel = modalCancel;
    window._saveSessionData = saveSessionData;
    window._clearSessionData = clearSessionData;
    window._getSessionData = getSessionData;
    window._setRememberMe = setRememberMe;
    window._checkRolePermission = checkRolePermission;

    console.log('🧵 Admin Base loaded');

})();