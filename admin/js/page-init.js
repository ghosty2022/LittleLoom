// ─── PAGE INITIALIZATION ──────────────────────────────────────────────────
// This script should be included at the bottom of every admin page

(function() {
    'use strict';

    // Get page name from URL
    const pageName = window.location.pathname.split('/').pop().replace('.html', '') || 'dashboard';

    // Initialize the page
    async function initPage() {
        // Initialize Supabase
        if (!window._initSupabase()) {
            window._showToast('Failed to initialize Supabase', 'error');
            return;
        }

        // Check authentication (silent, no overlay)
        const authed = await window._checkAuth();
        if (!authed) {
            // Will redirect to login
            return;
        }

        // Build sidebar
        window._buildSidebar();

        // Update UI with user info
        const session = window._getSession();
        const userRole = window._getUserRole();
        const config = window._CONFIG;

        if (session) {
            const nameEl = document.getElementById('sidebarName');
            const emailEl = document.getElementById('sidebarEmail');
            const avatarEl = document.getElementById('sidebarAvatar');
            const roleEl = document.getElementById('sidebarRole');

            if (nameEl) {
                const name = session.user?.user_metadata?.full_name || session.user?.email?.split('@')[0] || 'Admin';
                nameEl.textContent = name;
                if (avatarEl) avatarEl.textContent = name[0].toUpperCase();
            }
            if (emailEl) emailEl.textContent = session.user?.email || 'admin@littleloom.com';
            if (roleEl && config?.ROLES?.[userRole]) {
                roleEl.textContent = config.ROLES[userRole].label;
            }
        }

        // Check page access
        const allowedRoles = config?.PAGE_ROLES?.[pageName] || [];
        if (allowedRoles.length > 0 && !allowedRoles.includes(userRole) && userRole !== 'super_admin') {
            window._showToast('🔒 You do not have permission to access this page', 'warning');
            setTimeout(() => {
                window.location.href = '/admin/dashboard.html';
            }, 2000);
            return;
        }

        // Trigger page-specific load function if exists
        if (typeof window._loadPageData === 'function') {
            try {
                await window._loadPageData();
            } catch (e) {
                console.error('Page data load error:', e);
                window._showToast('Error loading page data: ' + e.message, 'error');
            }
        }

        // Update last updated time
        const lastUpdated = document.getElementById('lastUpdated');
        if (lastUpdated) {
            lastUpdated.textContent = new Date().toLocaleString();
        }

        console.log(`📄 ${pageName} page initialized`);
        console.log(`👤 User: ${session?.user?.email}`);
        console.log(`👑 Role: ${config?.ROLES?.[userRole]?.label || userRole}`);
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPage);
    } else {
        initPage();
    }

})();