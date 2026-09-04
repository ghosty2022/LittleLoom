// ─── PAGE INITIALIZATION ──────────────────────────────────────────────────

(function() {
    'use strict';

    const pageName = window.location.pathname.split('/').pop().replace('.html', '') || 'dashboard';

    async function initPage() {
        // Show loading overlay
        const overlay = document.getElementById('sessionCheckOverlay');
        if (overlay) overlay.classList.add('show');

        // Initialize Supabase
        if (!window._initSupabase()) {
            window._showToast('Failed to initialize Supabase', 'error');
            if (overlay) overlay.classList.remove('show');
            return;
        }

        // Check authentication
        const authed = await window._checkAuth();
        if (!authed) {
            if (overlay) overlay.classList.remove('show');
            return;
        }

        // Build sidebar
        window._buildSidebar();

        // Update UI with user info
        const session = window._getSession();

        if (session) {
            const nameEl = document.getElementById('sidebarName');
            const emailEl = document.getElementById('sidebarEmail');
            const avatarEl = document.getElementById('sidebarAvatar');

            if (nameEl) {
                const name = session.user?.user_metadata?.full_name || session.user?.email?.split('@')[0] || 'Admin';
                nameEl.textContent = name;
                if (avatarEl) avatarEl.textContent = name[0].toUpperCase();
            }
            if (emailEl) emailEl.textContent = session.user?.email || 'admin@littleloom.com';
        }

        // Hide overlay
        if (overlay) overlay.classList.remove('show');

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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPage);
    } else {
        initPage();
    }

})();