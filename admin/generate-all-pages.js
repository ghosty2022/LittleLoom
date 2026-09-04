// ─── GENERATE ALL ADMIN PAGES ──────────────────────────────────────────
const fs = require('fs');
const path = require('path');

const PAGES = [
    { id: 'babies', title: 'Babies', subtitle: 'Baby Management', icon: '👶' },
    { id: 'users', title: 'Users', subtitle: 'User Management', icon: '👤' },
    { id: 'moderation', title: 'Moderation', subtitle: 'Content Moderation', icon: '🛡️' },
    { id: 'community', title: 'Community', subtitle: 'Community Posts', icon: '💬' },
    { id: 'topics', title: 'Topics', subtitle: 'Discussion Topics', icon: '📌' },
    { id: 'announcements', title: 'Announcements', subtitle: 'Platform Announcements', icon: '📢' },
    { id: 'trackers', title: 'Trackers', subtitle: 'Tracker Entries', icon: '📈' },
    { id: 'milestones', title: 'Milestones', subtitle: 'Baby Milestones', icon: '🏆' },
    { id: 'analytics', title: 'Analytics', subtitle: 'Analytics Dashboard', icon: '📈' },
    { id: 'growth', title: 'Growth', subtitle: 'Growth Analytics', icon: '📊' },
    { id: 'activity', title: 'Activity', subtitle: 'Activity Heatmap', icon: '📈' },
    { id: 'settings', title: 'Settings', subtitle: 'System Settings', icon: '⚙️' },
    { id: 'backup', title: 'Backup', subtitle: 'Backup & Restore', icon: '💾' },
    { id: 'audit', title: 'Audit', subtitle: 'Audit Logs', icon: '📋' },
    { id: 'admin_roles', title: 'Admin Roles', subtitle: 'Role Management', icon: '👥' },
    { id: 'support', title: 'Support', subtitle: 'Support Tickets', icon: '🎫' },
    { id: 'api', title: 'API', subtitle: 'API Management', icon: '🔑' },
    { id: 'features', title: 'Features', subtitle: 'Feature Flags', icon: '🚩' },
    { id: 'health', title: 'Health', subtitle: 'System Health', icon: '❤️' },
    { id: 'performance', title: 'Performance', subtitle: 'Performance Metrics', icon: '⚡' },
    { id: 'qrcode', title: 'QR Codes', subtitle: 'QR Code Management', icon: '📱' },
    { id: 'realtime', title: 'Realtime', subtitle: 'Realtime Monitor', icon: '🔄' },
    { id: 'export', title: 'Export', subtitle: 'Data Export', icon: '📤' },
    { id: 'notifications', title: 'Notifications', subtitle: 'Notification Center', icon: '🔔' }
];

const templatePath = path.join(__dirname, 'pages', '_page_template.html');
let template = fs.readFileSync(templatePath, 'utf8');

PAGES.forEach(page => {
    let content = template
        .replace(/\{\{PAGE_TITLE\}\}/g, page.title)
        .replace(/\{\{PAGE_SUBTITLE\}\}/g, page.subtitle)
        .replace(/\{\{PAGE_CONTENT\}\}/g, `
            <div class="card">
                <div class="card-header">
                    <div class="card-title"><span class="emoji">${page.icon}</span> ${page.title}</div>
                    <span style="font-size:12px;color:var(--text-muted);">Manage ${page.title.toLowerCase()}</span>
                </div>
                <div class="card-body">
                    <div class="empty-state-modern">
                        <div class="emoji">${page.icon}</div>
                        <h3>${page.title} Management</h3>
                        <p style="font-size:13px;">This page is ready for ${page.title.toLowerCase()} management functionality.</p>
                        <p style="font-size:12px;color:var(--text-muted);margin-top:8px;">${page.subtitle}</p>
                    </div>
                </div>
            </div>
        `)
        .replace(/\{\{PAGE_SCRIPT\}\}/g, `
            // ─── ${page.title} Page Script ──────────────────────────────
            window._loadPageData = async function() {
                window._showToast('📊 Loading ${page.title} data...', 'info');
                // Add your page-specific data loading here
            };
            console.log('📄 ${page.title} page loaded');
        `);

    const filePath = path.join(__dirname, 'pages', `${page.id}.html`);
    fs.writeFileSync(filePath, content);
    console.log(`✅ Generated: ${page.id}.html`);
});

console.log('\n🎉 All pages generated successfully!');
console.log('📁 Pages are in the "pages" folder');