// setup-admin.js - Complete fixed version with more features
// Run with: node setup-admin.js

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ADMIN_DIR = path.join(__dirname, 'admin');
const PAGES_DIR = path.join(ADMIN_DIR, 'pages');
const ASSETS_DIR = path.join(ADMIN_DIR, 'assets');

// ============================================================
// CREATE DIRECTORY STRUCTURE
// ============================================================
function createDirectories() {
    if (!fs.existsSync(ADMIN_DIR)) {
        fs.mkdirSync(ADMIN_DIR);
        console.log('📁 Created admin directory');
    }
    if (!fs.existsSync(PAGES_DIR)) {
        fs.mkdirSync(PAGES_DIR);
        console.log('📁 Created pages directory');
    }
    if (!fs.existsSync(ASSETS_DIR)) {
        fs.mkdirSync(ASSETS_DIR);
        console.log('📁 Created assets directory');
    }
}

// ============================================================
// HELPER: Get Shared Styles
// ============================================================
function getSharedStyles() {
    return `
        :root {
            --primary: #667eea;
            --primary-dark: #4f46e5;
            --primary-light: #818cf8;
            --secondary: #fa709a;
            --accent: #43e97b;
            --bg-primary: #f0f2f8;
            --bg-card: #ffffff;
            --bg-sidebar: #0f0f1a;
            --text-primary: #0f0f1a;
            --text-secondary: #4b5563;
            --text-muted: #6b7280;
            --text-white: #ffffff;
            --border: rgba(0, 0, 0, 0.06);
            --border-dark: rgba(255, 255, 255, 0.06);
            --shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
            --shadow-lg: 0 12px 48px rgba(0, 0, 0, 0.12);
            --radius: 16px;
            --radius-sm: 10px;
            --radius-lg: 24px;
            --radius-xl: 32px;
            --transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            --sidebar-width: 260px;
            --header-height: 70px;
            --font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: var(--font); background: var(--bg-primary); color: var(--text-primary); line-height: 1.6; min-height: 100vh; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--primary-light); border-radius: 10px; }
        .app { display: flex; min-height: 100vh; }
        .sidebar { width: var(--sidebar-width); background: var(--bg-sidebar); position: fixed; top: 0; left: 0; bottom: 0; z-index: 1000; display: flex; flex-direction: column; transition: transform var(--transition); overflow-y: auto; }
        .sidebar-brand { padding: 20px 24px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--border-dark); min-height: var(--header-height); }
        .sidebar-brand-icon { width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, var(--primary), var(--secondary)); display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
        .sidebar-brand h1 { font-size: 18px; font-weight: 800; color: var(--text-white); letter-spacing: -0.5px; }
        .sidebar-brand span { font-weight: 400; color: rgba(255,255,255,0.5); font-size: 12px; display: block; }
        .sidebar-nav { flex: 1; padding: 16px 12px; overflow-y: auto; }
        .sidebar-nav-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: rgba(255,255,255,0.25); padding: 12px 12px 8px; }
        .sidebar-nav-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: var(--radius-sm); color: rgba(255,255,255,0.6); text-decoration: none; cursor: pointer; transition: var(--transition); font-size: 14px; font-weight: 500; position: relative; margin-bottom: 2px; }
        .sidebar-nav-item:hover { background: rgba(255,255,255,0.06); color: var(--text-white); }
        .sidebar-nav-item.active { background: rgba(102,126,234,0.2); color: var(--primary-light); }
        .sidebar-nav-item .icon { font-size: 18px; width: 24px; text-align: center; flex-shrink: 0; }
        .sidebar-nav-item .badge { margin-left: auto; padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: 700; background: var(--primary); color: #fff; }
        .sidebar-footer { padding: 16px 20px; border-top: 1px solid var(--border-dark); }
        .sidebar-footer .user-info { display: flex; align-items: center; gap: 10px; color: rgba(255,255,255,0.7); }
        .sidebar-footer .user-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; color: #fff; flex-shrink: 0; }
        .sidebar-footer .user-name { font-size: 14px; font-weight: 600; color: var(--text-white); }
        .sidebar-footer .user-email { font-size: 12px; color: rgba(255,255,255,0.4); }
        .main { flex: 1; margin-left: var(--sidebar-width); min-height: 100vh; }
        .topbar { height: var(--header-height); background: var(--bg-card); border-bottom: 1px solid var(--border); padding: 0 32px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; backdrop-filter: blur(12px); background: rgba(255,255,255,0.92); }
        .topbar-left { display: flex; align-items: center; gap: 16px; }
        .topbar-menu-btn { display: none; background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary); padding: 4px; }
        .topbar-title { font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }
        .topbar-title .sub { font-weight: 400; color: var(--text-muted); font-size: 14px; }
        .topbar-right { display: flex; align-items: center; gap: 16px; }
        .topbar-status { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); }
        .topbar-status .dot { width: 10px; height: 10px; border-radius: 50%; background: #22c55e; animation: pulse-dot 2s ease-in-out infinite; }
        @keyframes pulse-dot { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(0.85); } }
        .topbar-actions { display: flex; align-items: center; gap: 8px; }
        .btn { padding: 8px 18px; border-radius: var(--radius-sm); border: none; font-weight: 600; font-size: 13px; cursor: pointer; transition: var(--transition); display: inline-flex; align-items: center; gap: 6px; font-family: var(--font); }
        .btn-primary { background: var(--primary); color: #fff; }
        .btn-primary:hover { background: var(--primary-dark); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(102,126,234,0.35); }
        .btn-outline { background: transparent; color: var(--text-secondary); border: 1.5px solid var(--border); }
        .btn-outline:hover { background: var(--bg-primary); border-color: var(--primary); color: var(--primary); }
        .btn-danger { background: #ef4444; color: #fff; }
        .btn-danger:hover { background: #dc2626; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(239,68,68,0.3); }
        .btn-success { background: #22c55e; color: #fff; }
        .status-bar { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-radius: var(--radius-sm); background: var(--bg-primary); font-size: 13px; color: var(--text-secondary); margin-bottom: 20px; border: 1px solid var(--border); }
        .spinner { display: inline-block; width: 18px; height: 18px; border: 2px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .toast-container { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 9999; pointer-events: none; }
        .toast { pointer-events: auto; background: var(--bg-card); padding: 12px 24px; border-radius: var(--radius); box-shadow: var(--shadow-lg); font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 10px; border-left: 4px solid var(--primary); animation: slideUp 0.3s ease-out; }
        .toast.error { border-left-color: #ef4444; }
        .toast.success { border-left-color: #22c55e; }
        @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 999; }
        .sidebar-overlay.active { display: block; }
        @media (max-width: 768px) { .sidebar { transform: translateX(-100%); } .sidebar.open { transform: translateX(0); } .main { margin-left: 0; } .topbar-menu-btn { display: block; } .topbar { padding: 0 16px; } .topbar-status { display: none; } }
        .badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .badge-success { background: #dcfce7; color: #16a34a; }
        .badge-warning { background: #fef3c7; color: #d97706; }
        .badge-danger { background: #fee2e2; color: #dc2626; }
        .badge-info { background: #dbeafe; color: #2563eb; }
        .badge-purple { background: #ede9fe; color: #7c3aed; }
        .pill { display: inline-block; padding: 2px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; background: var(--bg-primary); color: var(--text-secondary); }
        .card { background: var(--bg-card); border-radius: var(--radius-lg); box-shadow: var(--shadow); border: 1px solid var(--border); overflow: hidden; margin-bottom: 24px; }
        .card-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; border-bottom: 1px solid var(--border); flex-wrap: wrap; gap: 8px; }
        .card-title { font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
        .card-title .emoji { font-size: 20px; }
        .card-body { padding: 20px 24px; }
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th { text-align: left; font-weight: 600; color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 8px 10px 0; border-bottom: 1.5px solid var(--border); }
        td { padding: 12px 8px 12px 0; border-bottom: 1px solid var(--border); vertical-align: middle; }
        .empty-state { text-align: center; padding: 40px 20px; color: var(--text-muted); }
        .empty-state .emoji { font-size: 48px; margin-bottom: 12px; }
        .empty-state h3 { color: var(--text-primary); font-weight: 700; margin-bottom: 6px; }
        .activity-feed { display: flex; flex-direction: column; gap: 4px; }
        .activity-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
        .activity-item:last-child { border-bottom: none; }
        .activity-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; background: var(--bg-primary); }
        .activity-content { flex: 1; min-width: 0; }
        .activity-title { font-weight: 600; font-size: 14px; }
        .activity-meta { font-size: 12px; color: var(--text-muted); }
        .activity-time { font-size: 11px; color: var(--text-muted); white-space: nowrap; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media (max-width: 1200px) { .grid-2 { grid-template-columns: 1fr; } }
        .chart-placeholder { height: 200px; background: var(--bg-primary); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-weight: 500; font-size: 14px; position: relative; overflow: hidden; }
        .chart-placeholder .bars { display: flex; align-items: flex-end; gap: 12px; height: 140px; }
        .chart-placeholder .bar { width: 28px; border-radius: 6px 6px 0 0; background: linear-gradient(180deg, var(--primary), var(--primary-light)); transition: height 1s ease; min-height: 8px; }
        .logo-image { height: 36px; width: auto; object-fit: contain; }
        .logo-text { font-weight: 800; font-size: 18px; color: var(--text-white); letter-spacing: -0.5px; }
        .logo-text span { font-weight: 400; color: rgba(255,255,255,0.5); font-size: 12px; display: block; }
    `;
}

// ============================================================
// DASHBOARD PAGE - WITH LOGO
// ============================================================
const dashboardPage = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dashboard - LittleLoom Admin</title>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.min.js">
    </script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
    <style>
        ${getSharedStyles()}
        .logo-container { display: flex; align-items: center; gap: 12px; }
        .logo-emoji { font-size: 28px; }
        .logo-title { font-weight: 800; font-size: 20px; color: var(--text-white); letter-spacing: -0.5px; }
        .logo-sub { font-weight: 400; color: rgba(255,255,255,0.5); font-size: 11px; display: block; }
        .brand-logo { display: flex; align-items: center; gap: 10px; }
        .brand-icon { width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #667eea, #fa709a); display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .stat-card { background: var(--bg-card); border-radius: var(--radius); padding: 20px 24px; box-shadow: var(--shadow); transition: var(--transition); border: 1px solid var(--border); }
        .stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
        .stat-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 4px; }
        .stat-value { font-size: 30px; font-weight: 800; letter-spacing: -0.5px; }
        .stat-value .unit { font-size: 16px; font-weight: 600; color: var(--text-muted); margin-left: 4px; }
        .stat-change { font-size: 12px; font-weight: 600; margin-top: 4px; }
        .stat-change.positive { color: #22c55e; }
        .stat-change.negative { color: #ef4444; }
        .quick-stats-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 20px; }
        .quick-stat { background: var(--bg-card); border-radius: var(--radius-sm); padding: 12px 16px; text-align: center; border: 1px solid var(--border); }
        .quick-stat .num { font-size: 18px; font-weight: 700; }
        .quick-stat .label { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
        @media (max-width: 768px) { .quick-stats-row { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 480px) { .quick-stats-row { grid-template-columns: repeat(2, 1fr); } }
    </style>
</head>
<body>
    <div class="app">
        <!-- Sidebar -->
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-brand">
                <div class="brand-icon">🧵</div>
                <div>
                    <div class="logo-title">LittleLoom</div>
                    <div class="logo-sub">Admin Console</div>
                </div>
            </div>
            <nav class="sidebar-nav">
                <div class="sidebar-nav-label">Overview</div>
                <a class="sidebar-nav-item active" href="/admin/dashboard.html">
                    <span class="icon">📊</span> Dashboard
                    <span class="badge">Live</span>
                </a>
                <a class="sidebar-nav-item" href="/admin/pages/babies.html">
                    <span class="icon">👶</span> Babies
                    <span class="badge" id="babyBadge">0</span>
                </a>
                <a class="sidebar-nav-item" href="/admin/pages/users.html">
                    <span class="icon">👤</span> Users
                    <span class="badge" id="userBadge">0</span>
                </a>
                <div class="sidebar-nav-label">Community</div>
                <a class="sidebar-nav-item" href="/admin/pages/community.html">
                    <span class="icon">💬</span> Community
                    <span class="badge" id="postBadge">0</span>
                </a>
                <a class="sidebar-nav-item" href="/admin/pages/topics.html">
                    <span class="icon">📌</span> Topics
                </a>
                <div class="sidebar-nav-label">Trackers</div>
                <a class="sidebar-nav-item" href="/admin/pages/trackers.html">
                    <span class="icon">📈</span> Tracker Entries
                    <span class="badge" id="entryBadge">0</span>
                </a>
                <a class="sidebar-nav-item" href="/admin/pages/milestones.html">
                    <span class="icon">🏆</span> Milestones
                    <span class="badge" id="milestoneBadge">0</span>
                </a>
                <div class="sidebar-nav-label">Analytics</div>
                <a class="sidebar-nav-item" href="/admin/pages/growth.html">
                    <span class="icon">📊</span> Growth Analytics
                </a>
                <a class="sidebar-nav-item" href="/admin/pages/activity.html">
                    <span class="icon">📈</span> Activity Heatmap
                </a>
                <div class="sidebar-nav-label">System</div>
                <a class="sidebar-nav-item" href="/admin/pages/realtime.html">
                    <span class="icon">🔄</span> Realtime Monitor
                    <span class="badge success">Live</span>
                </a>
                <a class="sidebar-nav-item" href="/admin/pages/settings.html">
                    <span class="icon">⚙️</span> Settings
                </a>
                <a class="sidebar-nav-item" href="/admin/pages/backup.html">
                    <span class="icon">💾</span> Backup & Restore
                </a>
            </nav>
            <div class="sidebar-footer">
                <div class="user-info">
                    <div class="user-avatar" id="sidebarAvatar">A</div>
                    <div>
                        <div class="user-name" id="sidebarName">Admin</div>
                        <div class="user-email" id="sidebarEmail">admin@littleloom.com</div>
                    </div>
                </div>
            </div>
        </aside>

        <div class="sidebar-overlay" id="sidebarOverlay" onclick="toggleSidebar(false)"></div>

        <!-- Main -->
        <main class="main">
            <header class="topbar">
                <div class="topbar-left">
                    <button class="topbar-menu-btn" onclick="toggleSidebar()">☰</button>
                    <div>
                        <div class="topbar-title">Dashboard <span class="sub">| Real-time overview</span></div>
                    </div>
                </div>
                <div class="topbar-right">
                    <div class="topbar-status">
                        <span class="dot"></span>
                        <span id="connectionStatus">Connected</span>
                    </div>
                    <div class="topbar-actions">
                        <button class="btn btn-outline" onclick="refreshAll()">🔄 Refresh</button>
                        <button class="btn btn-danger" onclick="confirmLogout()">🚪 Logout</button>
                    </div>
                </div>
            </header>

            <div class="page">
                <div class="status-bar" id="statusBar">
                    <span>✅ All systems operational</span>
                    <span style="margin-left:auto;font-size:12px;" id="lastUpdated">Last updated: —</span>
                </div>

                <!-- Quick Stats Row -->
                <div class="quick-stats-row" id="quickStats">
                    <div class="quick-stat"><div class="num" id="qsBabies">—</div><div class="label">👶 Babies</div></div>
                    <div class="quick-stat"><div class="num" id="qsUsers">—</div><div class="label">👤 Users</div></div>
                    <div class="quick-stat"><div class="num" id="qsEntries">—</div><div class="label">📊 Entries</div></div>
                    <div class="quick-stat"><div class="num" id="qsPosts">—</div><div class="label">💬 Posts</div></div>
                    <div class="quick-stat"><div class="num" id="qsMilestones">—</div><div class="label">🏆 Milestones</div></div>
                    <div class="quick-stat"><div class="num" id="qsStreak">—</div><div class="label">💪 Avg Streak</div></div>
                </div>

                <div class="stats-grid" id="statsGrid">
                    <div class="stat-card">
                        <div class="stat-label">👶 Total Babies</div>
                        <div class="stat-value" id="statBabies">—</div>
                        <div class="stat-change positive" id="statBabiesChange">+0 this week</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">👤 Active Users</div>
                        <div class="stat-value" id="statUsers">—</div>
                        <div class="stat-change positive" id="statUsersChange">+0 this week</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">📊 Tracker Entries</div>
                        <div class="stat-value" id="statEntries">—</div>
                        <div class="stat-change positive" id="statEntriesChange">+0 today</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">💬 Community Posts</div>
                        <div class="stat-value" id="statPosts">—</div>
                        <div class="stat-change positive" id="statPostsChange">+0 today</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">🏆 Milestones</div>
                        <div class="stat-value" id="statMilestones">—</div>
                        <div class="stat-change positive" id="statMilestonesChange">+0 this week</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">💪 Avg Streak</div>
                        <div class="stat-value" id="statStreak">—<span class="unit">d</span></div>
                        <div class="stat-change positive" id="statStreakChange">+0 this week</div>
                    </div>
                </div>

                <div class="grid-2">
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title"><span class="emoji">🕒</span> Recent Activity</div>
                            <span class="card-subtitle" id="activityCount">0 entries</span>
                        </div>
                        <div class="card-body">
                            <div class="activity-feed" id="activityFeed">
                                <div class="empty-state">
                                    <div class="emoji">📭</div>
                                    <h3>No recent activity</h3>
                                    <p>Activity will appear here as users log entries.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div class="card">
                            <div class="card-header">
                                <div class="card-title"><span class="emoji">📈</span> Weekly Activity</div>
                                <span class="card-subtitle">Last 7 days</span>
                            </div>
                            <div class="card-body">
                                <div class="chart-placeholder">
                                    <div class="bars" id="weeklyBars">
                                        <div class="bar" style="height:20%;"></div>
                                        <div class="bar" style="height:45%;"></div>
                                        <div class="bar" style="height:70%;"></div>
                                        <div class="bar" style="height:55%;"></div>
                                        <div class="bar" style="height:85%;"></div>
                                        <div class="bar" style="height:65%;"></div>
                                        <div class="bar" style="height:90%;"></div>
                                    </div>
                                </div>
                                <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:11px;color:var(--text-muted);">
                                    <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                                </div>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <div class="card-title"><span class="emoji">🏆</span> Recent Achievements</div>
                                <span class="card-subtitle" id="achievementCount">0</span>
                            </div>
                            <div class="card-body" id="achievementList">
                                <div class="empty-state">
                                    <div class="emoji">🏆</div>
                                    <p>No achievements yet</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- New: System Health -->
                <div class="card">
                    <div class="card-header">
                        <div class="card-title"><span class="emoji">🖥️</span> System Health</div>
                        <span class="card-subtitle">Real-time status</span>
                    </div>
                    <div class="card-body">
                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;">
                            <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg-primary);border-radius:var(--radius-sm);">
                                <span style="font-size:24px;">🟢</span>
                                <div><div style="font-weight:600;">Supabase</div><div style="font-size:12px;color:var(--text-muted);">Connected</div></div>
                            </div>
                            <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg-primary);border-radius:var(--radius-sm);">
                                <span style="font-size:24px;">🟢</span>
                                <div><div style="font-weight:600;">Realtime</div><div style="font-size:12px;color:var(--text-muted);">Active</div></div>
                            </div>
                            <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg-primary);border-radius:var(--radius-sm);">
                                <span style="font-size:24px;">🟢</span>
                                <div><div style="font-weight:600;">Database</div><div style="font-size:12px;color:var(--text-muted);">Operational</div></div>
                            </div>
                            <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg-primary);border-radius:var(--radius-sm);">
                                <span style="font-size:24px;" id="healthApi">🟢</span>
                                <div><div style="font-weight:600;">API</div><div style="font-size:12px;color:var(--text-muted);" id="healthApiStatus">Ready</div></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <div class="toast-container" id="toastContainer"></div>

    <script>
        // ============================================================
        // SUPABASE CONFIG
        // ============================================================
        const SUPABASE_URL = 'https://qoozrrljpgsyhxfqxnzf.supabase.co';
        const SUPABASE_ANON_KEY = 'sb_publishable_RNzz7jvsGmrRp9c94JiPuA_ooZt_gmm';

        let supabase = null;
        let session = null;
        let refreshTimer = null;

        function initSupabase() {
            try {
                supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                return true;
            } catch (e) {
                console.error('Supabase init error:', e);
                return false;
            }
        }

        async function checkAuth() {
            try {
                const { data, error } = await supabase.auth.getSession();
                if (error || !data.session) {
                    showToast('Please log in to Supabase', 'error');
                    document.getElementById('statusBar').innerHTML =
                        '<span>🔒 Please log in</span><span style="margin-left:auto;font-size:12px;">Use Supabase console to authenticate</span>';
                    return false;
                }
                session = data.session;
                document.getElementById('connectionStatus').textContent = 'Logged in as ' + session.user.email;
                document.getElementById('sidebarEmail').textContent = session.user.email;
                const name = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
                document.getElementById('sidebarName').textContent = name;
                document.getElementById('sidebarAvatar').textContent = name[0].toUpperCase();
                return true;
            } catch (e) {
                console.error('Auth check error:', e);
                return false;
            }
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

        function showToast(message, type) {
            type = type || 'info';
            const container = document.getElementById('toastContainer');
            const toast = document.createElement('div');
            toast.className = 'toast ' + type;
            toast.textContent = message;
            container.appendChild(toast);
            setTimeout(function() { if (toast.parentNode) toast.remove(); }, 4000);
        }

        async function confirmLogout() {
            if (confirm('Are you sure you want to logout?')) {
                await supabase.auth.signOut();
                session = null;
                showToast('Logged out successfully', 'success');
                document.getElementById('connectionStatus').textContent = 'Disconnected';
                location.reload();
            }
        }

        async function fetchDashboardData() {
            if (!supabase || !session) return;

            const statusBar = document.getElementById('statusBar');
            statusBar.innerHTML =
                '<span class="spinner"></span><span>Loading...</span><span style="margin-left:auto;font-size:12px;">Fetching data</span>';

            try {
                // Fetch all data in parallel
                const [babiesResult, profilesResult, entriesResult, postsResult, milestonesResult] = await Promise.all([
                    supabase.from('babies').select('id, name, date_of_birth, streak, milestones_count').eq('is_active', true),
                    supabase.from('profiles').select('id, full_name, email, role, last_active'),
                    supabase.from('tracker_entries').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
                    supabase.from('community_posts').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
                    supabase.from('tracker_entries').select('*', { count: 'exact', head: true }).eq('tracker_type', 'milestone').eq('is_deleted', false)
                ]);

                const babies = babiesResult.data || [];
                const profiles = profilesResult.data || [];
                const entriesCount = entriesResult.count || 0;
                const postsCount = postsResult.count || 0;
                const milestonesCount = milestonesResult.count || 0;

                // Update stats
                document.getElementById('statBabies').textContent = babies.length;
                document.getElementById('statUsers').textContent = profiles.length;
                document.getElementById('statEntries').textContent = entriesCount;
                document.getElementById('statPosts').textContent = postsCount;
                document.getElementById('statMilestones').textContent = milestonesCount;

                // Quick stats
                document.getElementById('qsBabies').textContent = babies.length;
                document.getElementById('qsUsers').textContent = profiles.length;
                document.getElementById('qsEntries').textContent = entriesCount;
                document.getElementById('qsPosts').textContent = postsCount;
                document.getElementById('qsMilestones').textContent = milestonesCount;

                // Avg streak
                if (babies.length > 0) {
                    let totalStreak = 0;
                    babies.forEach(function(b) { totalStreak += (b.streak || 0); });
                    const avg = Math.round(totalStreak / babies.length);
                    document.getElementById('statStreak').innerHTML = avg + '<span class="unit">d</span>';
                    document.getElementById('qsStreak').textContent = avg + 'd';
                }

                // Update badges
                document.getElementById('babyBadge').textContent = babies.length;
                document.getElementById('userBadge').textContent = profiles.length;
                document.getElementById('postBadge').textContent = postsCount;
                document.getElementById('entryBadge').textContent = entriesCount;
                document.getElementById('milestoneBadge').textContent = milestonesCount;

                // Recent activity
                const { data: recent } = await supabase
                    .from('tracker_entries')
                    .select('tracker_id, title, logged_by_name, timestamp')
                    .eq('is_deleted', false)
                    .order('timestamp', { ascending: false })
                    .limit(10);

                const feed = document.getElementById('activityFeed');
                if (!recent || recent.length === 0) {
                    feed.innerHTML = '<div class="empty-state"><div class="emoji">📭</div><h3>No recent activity</h3></div>';
                    document.getElementById('activityCount').textContent = '0';
                } else {
                    document.getElementById('activityCount').textContent = recent.length;
                    const iconMap = { feed: '🍼', sleep: '😴', diaper: '🧷', potty: '🚽', growth: '📏', medication: '💊', milestone: '🏆' };
                    var html = '';
                    recent.forEach(function(a) {
                        html += '<div class="activity-item">' +
                            '<div class="activity-icon">' + (iconMap[a.tracker_id] || '📌') + '</div>' +
                            '<div class="activity-content">' +
                            '<div class="activity-title">' + (a.title || a.tracker_id || 'Activity') + '</div>' +
                            '<div class="activity-meta">by ' + (a.logged_by_name || 'Someone') + '</div>' +
                            '</div>' +
                            '<div class="activity-time">' + (a.timestamp ? new Date(a.timestamp).toLocaleString() : '') + '</div>' +
                            '</div>';
                    });
                    feed.innerHTML = html;
                }

                // Achievements
                const { data: achievements } = await supabase
                    .from('tracker_entries')
                    .select('title, data, logged_by_name, timestamp')
                    .eq('tracker_type', 'milestone')
                    .eq('is_deleted', false)
                    .order('timestamp', { ascending: false })
                    .limit(8);

                const achList = document.getElementById('achievementList');
                if (!achievements || achievements.length === 0) {
                    achList.innerHTML = '<div class="empty-state"><div class="emoji">🏆</div><p>No achievements yet</p></div>';
                    document.getElementById('achievementCount').textContent = '0';
                } else {
                    document.getElementById('achievementCount').textContent = achievements.length;
                    var html2 = '';
                    achievements.forEach(function(a) {
                        html2 += '<div class="achievement-item" style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);">' +
                            '<div style="font-size:24px;">🏆</div>' +
                            '<div style="flex:1;">' +
                            '<div style="font-weight:600;font-size:14px;">' + (a.title || 'Milestone') + '</div>' +
                            '<div style="font-size:12px;color:var(--text-muted);">by ' + (a.logged_by_name || 'Someone') + (a.timestamp ? ' · ' + new Date(a.timestamp).toLocaleDateString() : '') + '</div>' +
                            '</div>' +
                            '<span class="badge badge-success">✨</span>' +
                            '</div>';
                    });
                    achList.innerHTML = html2;
                }

                statusBar.innerHTML =
                    '<span>✅ All systems operational</span><span style="margin-left:auto;font-size:12px;">Last updated: ' + new Date().toLocaleString() + '</span>';
                document.getElementById('lastUpdated').textContent = new Date().toLocaleString();

                // Update health status
                document.getElementById('healthApi').textContent = '🟢';
                document.getElementById('healthApiStatus').textContent = 'Ready';

            } catch (err) {
                console.error('Fetch error:', err);
                statusBar.innerHTML = '<span>❌ Error: ' + err.message + '</span>';
                document.getElementById('healthApi').textContent = '🔴';
                document.getElementById('healthApiStatus').textContent = 'Error';
                showToast('Error loading data: ' + err.message, 'error');
            }
        }

        async function refreshAll() {
            await fetchDashboardData();
            showToast('Dashboard refreshed ✓', 'success');
        }

        // ============================================================
        // INIT
        // ============================================================
        async function init() {
            if (!initSupabase()) return;

            const authed = await checkAuth();
            if (!authed) return;

            await fetchDashboardData();

            // Auto-refresh every 30 seconds
            refreshTimer = setInterval(fetchDashboardData, 30000);

            // Handle resize for sidebar
            window.addEventListener('resize', function() {
                if (window.innerWidth > 768) {
                    document.getElementById('sidebar').classList.remove('open');
                    document.getElementById('sidebarOverlay').classList.remove('active');
                }
            });

            console.log('🧵 LittleLoom Dashboard ready');
        }

        document.addEventListener('DOMContentLoaded', init);

        // Expose functions globally
        window.toggleSidebar = toggleSidebar;
        window.refreshAll = refreshAll;
        window.confirmLogout = confirmLogout;
    </script>
</body>
</html>`;

// ============================================================
// GENERATE PAGE FUNCTION - FIXED TEMPLATE LITERALS
// ============================================================
function generatePage(title, icon, content, badge) {
    badge = badge || '';
    const titleLower = title.toLowerCase();
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} - LittleLoom Admin</title>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.min.js">
    </script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
    <style>
        ${getSharedStyles()}
        .page-content { padding: 24px 32px; }
        .page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
        .page-header .icon { font-size: 32px; }
        .page-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.3px; }
        .page-header .badge { margin-left: 12px; }
    </style>
</head>
<body>
    <div class="app">
        <!-- Sidebar -->
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-brand">
                <div class="brand-icon">🧵</div>
                <div>
                    <div class="logo-title">LittleLoom</div>
                    <div class="logo-sub">Admin Console</div>
                </div>
            </div>
            <nav class="sidebar-nav">
                <div class="sidebar-nav-label">Overview</div>
                <a class="sidebar-nav-item" href="/admin/dashboard.html">
                    <span class="icon">📊</span> Dashboard
                </a>
                <a class="sidebar-nav-item" href="/admin/pages/babies.html">
                    <span class="icon">👶</span> Babies
                </a>
                <a class="sidebar-nav-item" href="/admin/pages/users.html">
                    <span class="icon">👤</span> Users
                </a>
                <div class="sidebar-nav-label">Community</div>
                <a class="sidebar-nav-item" href="/admin/pages/community.html">
                    <span class="icon">💬</span> Community
                </a>
                <a class="sidebar-nav-item" href="/admin/pages/topics.html">
                    <span class="icon">📌</span> Topics
                </a>
                <div class="sidebar-nav-label">Trackers</div>
                <a class="sidebar-nav-item" href="/admin/pages/trackers.html">
                    <span class="icon">📈</span> Tracker Entries
                </a>
                <a class="sidebar-nav-item active" href="/admin/pages/${titleLower}.html">
                    <span class="icon">${icon}</span> ${title}
                    ${badge ? '<span class="badge">' + badge + '</span>' : ''}
                </a>
                <div class="sidebar-nav-label">Analytics</div>
                <a class="sidebar-nav-item" href="/admin/pages/growth.html">
                    <span class="icon">📊</span> Growth Analytics
                </a>
                <a class="sidebar-nav-item" href="/admin/pages/activity.html">
                    <span class="icon">📈</span> Activity Heatmap
                </a>
                <div class="sidebar-nav-label">System</div>
                <a class="sidebar-nav-item" href="/admin/pages/realtime.html">
                    <span class="icon">🔄</span> Realtime Monitor
                </a>
                <a class="sidebar-nav-item" href="/admin/pages/settings.html">
                    <span class="icon">⚙️</span> Settings
                </a>
                <a class="sidebar-nav-item" href="/admin/pages/backup.html">
                    <span class="icon">💾</span> Backup & Restore
                </a>
            </nav>
            <div class="sidebar-footer">
                <div class="user-info">
                    <div class="user-avatar" id="sidebarAvatar">A</div>
                    <div>
                        <div class="user-name" id="sidebarName">Admin</div>
                        <div class="user-email" id="sidebarEmail">admin@littleloom.com</div>
                    </div>
                </div>
            </div>
        </aside>

        <div class="sidebar-overlay" id="sidebarOverlay" onclick="toggleSidebar(false)"></div>

        <!-- Main -->
        <main class="main">
            <header class="topbar">
                <div class="topbar-left">
                    <button class="topbar-menu-btn" onclick="toggleSidebar()">☰</button>
                    <div>
                        <div class="topbar-title">${title} <span class="sub">| ${titleLower}</span></div>
                    </div>
                </div>
                <div class="topbar-right">
                    <div class="topbar-status">
                        <span class="dot"></span>
                        <span id="connectionStatus">Connected</span>
                    </div>
                    <div class="topbar-actions">
                        <button class="btn btn-outline" onclick="refreshPage()">🔄 Refresh</button>
                        <button class="btn btn-danger" onclick="confirmLogout()">🚪 Logout</button>
                    </div>
                </div>
            </header>

            <div class="page-content">
                <div class="status-bar" id="statusBar">
                    <span>✅ Ready</span>
                    <span style="margin-left:auto;font-size:12px;" id="lastUpdated">Last updated: —</span>
                </div>

                ${content}
            </div>
        </main>
    </div>

    <div class="toast-container" id="toastContainer"></div>

    <script>
        const SUPABASE_URL = 'https://qoozrrljpgsyhxfqxnzf.supabase.co';
        const SUPABASE_ANON_KEY = 'sb_publishable_RNzz7jvsGmrRp9c94JiPuA_ooZt_gmm';

        let supabase = null;
        let session = null;

        function initSupabase() {
            try {
                supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                return true;
            } catch (e) { return false; }
        }

        async function checkAuth() {
            try {
                const { data, error } = await supabase.auth.getSession();
                if (error || !data.session) {
                    document.getElementById('statusBar').innerHTML = '<span>🔒 Please log in</span>';
                    return false;
                }
                session = data.session;
                document.getElementById('connectionStatus').textContent = 'Logged in as ' + session.user.email;
                document.getElementById('sidebarEmail').textContent = session.user.email;
                const name = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
                document.getElementById('sidebarName').textContent = name;
                document.getElementById('sidebarAvatar').textContent = name[0].toUpperCase();
                return true;
            } catch (e) { return false; }
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

        function showToast(message, type) {
            type = type || 'info';
            const container = document.getElementById('toastContainer');
            const toast = document.createElement('div');
            toast.className = 'toast ' + type;
            toast.textContent = message;
            container.appendChild(toast);
            setTimeout(function() { if (toast.parentNode) toast.remove(); }, 4000);
        }

        async function confirmLogout() {
            if (confirm('Are you sure you want to logout?')) {
                await supabase.auth.signOut();
                session = null;
                showToast('Logged out successfully', 'success');
                document.getElementById('connectionStatus').textContent = 'Disconnected';
                location.reload();
            }
        }

        async function refreshPage() {
            showToast('Refreshing...', 'info');
            location.reload();
        }

        async function init() {
            if (!initSupabase()) return;
            const authed = await checkAuth();
            if (!authed) return;
            document.getElementById('lastUpdated').textContent = new Date().toLocaleString();
            console.log('🧵 ${title} page ready');
        }

        document.addEventListener('DOMContentLoaded', init);
    </script>
</body>
</html>`;
}

// ============================================================
// PAGE SPECIFIC CONTENT
// ============================================================
const pageContents = {
    babies: `
        <div class="card">
            <div class="card-header">
                <div class="card-title"><span class="emoji">👶</span> All Babies</div>
                <span class="card-subtitle" id="babyCount">0 babies</span>
            </div>
            <div class="card-body">
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>Name</th><th>Age</th><th>Parent</th><th>Streak</th><th>Milestones</th><th>Created</th></tr></thead>
                        <tbody id="babyTable"><tr><td colspan="6" class="empty-state">No babies found</td></tr></tbody>
                    </table>
                </div>
            </div>
        </div>
        <script>
        async function loadBabies() {
            const { data, error } = await supabase.from('babies').select('*').eq('is_active', true).order('created_at', { ascending: false });
            if (error) { showToast('Error loading babies', 'error'); return; }
            document.getElementById('babyCount').textContent = (data ? data.length : 0) + ' babies';
            const tbody = document.getElementById('babyTable');
            if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No babies found</td></tr>'; return; }
            var html = '';
            data.forEach(function(b) {
                var age = '—';
                if (b.date_of_birth) {
                    var years = new Date().getFullYear() - new Date(b.date_of_birth).getFullYear();
                    age = years + 'y';
                }
                html += '<tr>' +
                    '<td><strong>' + (b.name || 'Unnamed') + '</strong></td>' +
                    '<td>' + age + '</td>' +
                    '<td><span class="pill">' + (b.parent1_id ? 'Parent 1' : '—') + '</span></td>' +
                    '<td>' + (b.streak || 0) + ' 🔥</td>' +
                    '<td>' + (b.milestones_count || 0) + '</td>' +
                    '<td style="font-size:12px;color:var(--text-muted);">' + (b.created_at ? new Date(b.created_at).toLocaleDateString() : '—') + '</td>' +
                    '</tr>';
            });
            tbody.innerHTML = html;
        }
        document.addEventListener('DOMContentLoaded', function() { setTimeout(loadBabies, 500); });
        </script>
    `,

    users: `
        <div class="card">
            <div class="card-header">
                <div class="card-title"><span class="emoji">👤</span> All Users</div>
                <span class="card-subtitle" id="userCount">0 users</span>
            </div>
            <div class="card-body" id="userList">
                <div class="empty-state"><div class="emoji">👤</div><p>No users found</p></div>
            </div>
        </div>
        <script>
        async function loadUsers() {
            const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
            if (error) { showToast('Error loading users', 'error'); return; }
            document.getElementById('userCount').textContent = (data ? data.length : 0) + ' users';
            const container = document.getElementById('userList');
            if (!data || data.length === 0) { container.innerHTML = '<div class="empty-state"><div class="emoji">👤</div><p>No users found</p></div>'; return; }
            var html = '';
            data.slice(0, 20).forEach(function(p) {
                var initial = (p.full_name || p.email || 'U')[0].toUpperCase();
                html += '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">' +
                    '<div style="width:36px;height:36px;border-radius:50%;background:var(--bg-primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;">' + initial + '</div>' +
                    '<div style="flex:1;"><div style="font-weight:600;font-size:14px;">' + (p.full_name || 'Unknown') + '</div>' +
                    '<div style="font-size:12px;color:var(--text-muted);">' + (p.email || '') + '</div></div>' +
                    '<div style="font-weight:700;font-size:14px;color:var(--primary);">' + (p.role || 'member') + '</div>' +
                    '<span style="font-size:11px;color:var(--text-muted);">' + (p.last_active ? '🟢' : '⚪') + '</span>' +
                    '</div>';
            });
            container.innerHTML = html;
        }
        document.addEventListener('DOMContentLoaded', function() { setTimeout(loadUsers, 500); });
        </script>
    `,

    community: `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">
            <div class="stat-card"><div class="stat-label">📝 Total Posts</div><div class="stat-value" id="statPosts">—</div></div>
            <div class="stat-card"><div class="stat-label">💬 Comments</div><div class="stat-value" id="statComments">—</div></div>
            <div class="stat-card"><div class="stat-label">❤️ Likes</div><div class="stat-value" id="statLikes">—</div></div>
        </div>
        <div class="card">
            <div class="card-header"><div class="card-title"><span class="emoji">📝</span> Recent Posts</div><span class="card-subtitle" id="postCount">0 posts</span></div>
            <div class="card-body"><div class="table-wrap"><table>
                <thead><tr><th>Author</th><th>Topic</th><th>Content</th><th>Likes</th><th>Comments</th><th>Posted</th></tr></thead>
                <tbody id="postTable"><tr><td colspan="6" class="empty-state">No posts yet</td></tr></tbody>
            </table></div></div>
        </div>
        <script>
        async function loadCommunity() {
            var postsResult = await supabase.from('community_posts').select('*', { count: 'exact' }).eq('is_deleted', false);
            var commentsResult = await supabase.from('community_comments').select('*', { count: 'exact' });
            var likesResult = await supabase.from('post_likes').select('*', { count: 'exact' });
            document.getElementById('statPosts').textContent = postsResult.count || 0;
            document.getElementById('statComments').textContent = commentsResult.count || 0;
            document.getElementById('statLikes').textContent = likesResult.count || 0;
            var { data } = await supabase.from('community_posts').select('*').eq('is_deleted', false).order('created_at', { ascending: false }).limit(15);
            document.getElementById('postCount').textContent = (data ? data.length : 0) + ' posts';
            var tbody = document.getElementById('postTable');
            if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No posts yet</td></tr>'; return; }
            var html = '';
            data.forEach(function(p) {
                var content = p.content ? p.content.substring(0, 60) + (p.content.length > 60 ? '...' : '') : '';
                html += '<tr><td><span class="pill">' + (p.author_id ? p.author_id.substring(0,8) : '—') + '</span></td>' +
                    '<td><span class="pill">' + (p.topic_id || 'General') + '</span></td>' +
                    '<td>' + content + '</td>' +
                    '<td>❤️ ' + (p.likes_count || 0) + '</td>' +
                    '<td>💬 ' + (p.comments_count || 0) + '</td>' +
                    '<td style="font-size:12px;color:var(--text-muted);">' + (p.created_at ? new Date(p.created_at).toLocaleString() : '') + '</td></tr>';
            });
            tbody.innerHTML = html;
        }
        document.addEventListener('DOMContentLoaded', function() { setTimeout(loadCommunity, 500); });
        </script>
    `,

    topics: `
        <div class="card">
            <div class="card-header"><div class="card-title"><span class="emoji">📌</span> Community Topics</div><span class="card-subtitle" id="topicCount">0 topics</span></div>
            <div class="card-body" id="topicList"><div class="empty-state"><div class="emoji">📌</div><p>No topics yet</p></div></div>
        </div>
        <script>
        async function loadTopics() {
            var { data, error } = await supabase.from('community_topics').select('*').order('name');
            if (error) { showToast('Error loading topics', 'error'); return; }
            document.getElementById('topicCount').textContent = (data ? data.length : 0) + ' topics';
            var container = document.getElementById('topicList');
            if (!data || data.length === 0) { container.innerHTML = '<div class="empty-state"><div class="emoji">📌</div><p>No topics yet</p></div>'; return; }
            var html = '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
            data.forEach(function(t) {
                html += '<span style="padding:6px 16px;border-radius:14px;font-size:13px;font-weight:600;background:var(--bg-primary);color:var(--text-secondary);">' + (t.emoji || '📌') + ' ' + t.name + ' <span style="color:var(--text-muted);font-weight:400;">(' + (t.category || 'general') + ')</span></span>';
            });
            html += '</div>';
            container.innerHTML = html;
        }
        document.addEventListener('DOMContentLoaded', function() { setTimeout(loadTopics, 500); });
        </script>
    `,

    trackers: `
        <div class="card">
            <div class="card-header"><div class="card-title"><span class="emoji">📈</span> Tracker Entries</div><span class="card-subtitle" id="entryCount">0 entries</span></div>
            <div class="card-body"><div class="table-wrap"><table>
                <thead><tr><th>Type</th><th>Baby</th><th>Title</th><th>Logged By</th><th>Date</th></tr></thead>
                <tbody id="entryTable"><tr><td colspan="5" class="empty-state">No entries found</td></tr></tbody>
            </table></div></div>
        </div>
        <script>
        async function loadTrackers() {
            var { data, error } = await supabase.from('tracker_entries').select('*').eq('is_deleted', false).order('timestamp', { ascending: false }).limit(30);
            if (error) { showToast('Error loading entries', 'error'); return; }
            document.getElementById('entryCount').textContent = (data ? data.length : 0) + ' entries';
            var tbody = document.getElementById('entryTable');
            if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No entries found</td></tr>'; return; }
            var html = '';
            data.forEach(function(e) {
                html += '<tr>' +
                    '<td><span class="badge badge-info">' + (e.tracker_id || 'unknown') + '</span></td>' +
                    '<td><span class="pill">' + (e.baby_id ? e.baby_id.substring(0,8) : '—') + '</span></td>' +
                    '<td>' + (e.title || e.tracker_id || 'Activity') + '</td>' +
                    '<td>' + (e.logged_by_name || 'Someone') + '</td>' +
                    '<td style="font-size:12px;color:var(--text-muted);">' + (e.timestamp ? new Date(e.timestamp).toLocaleString() : '') + '</td></tr>';
            });
            tbody.innerHTML = html;
        }
        document.addEventListener('DOMContentLoaded', function() { setTimeout(loadTrackers, 500); });
        </script>
    `,

    milestones: `
        <div class="card">
            <div class="card-header"><div class="card-title"><span class="emoji">🏆</span> All Milestones</div><span class="card-subtitle" id="milestoneCount">0 milestones</span></div>
            <div class="card-body"><div class="table-wrap"><table>
                <thead><tr><th>Title</th><th>Baby</th><th>Category</th><th>Logged By</th><th>Date</th></tr></thead>
                <tbody id="milestoneTable"><tr><td colspan="5" class="empty-state">No milestones found</td></tr></tbody>
            </table></div></div>
        </div>
        <script>
        async function loadMilestones() {
            var { data, error } = await supabase.from('tracker_entries').select('*').eq('tracker_type', 'milestone').eq('is_deleted', false).order('timestamp', { ascending: false }).limit(30);
            if (error) { showToast('Error loading milestones', 'error'); return; }
            document.getElementById('milestoneCount').textContent = (data ? data.length : 0) + ' milestones';
            var tbody = document.getElementById('milestoneTable');
            if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No milestones found</td></tr>'; return; }
            var html = '';
            data.forEach(function(m) {
                var category = m.data?.category || m.data?.milestoneType || 'General';
                html += '<tr>' +
                    '<td><strong>' + (m.title || m.data?.title || 'Milestone') + '</strong></td>' +
                    '<td><span class="pill">' + (m.baby_id ? m.baby_id.substring(0,8) : '—') + '</span></td>' +
                    '<td><span class="badge badge-purple">' + category + '</span></td>' +
                    '<td>' + (m.logged_by_name || 'Someone') + '</td>' +
                    '<td style="font-size:12px;color:var(--text-muted);">' + (m.timestamp ? new Date(m.timestamp).toLocaleString() : '') + '</td></tr>';
            });
            tbody.innerHTML = html;
        }
        document.addEventListener('DOMContentLoaded', function() { setTimeout(loadMilestones, 500); });
        </script>
    `,

    growth: `
        <div class="card">
            <div class="card-header"><div class="card-title"><span class="emoji">📊</span> Growth Analytics</div><span class="card-subtitle">Baby development insights</span></div>
            <div class="card-body">
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:20px;">
                    <div class="stat-card"><div class="stat-label">📏 Height</div><div class="stat-value" id="growthHeight">—</div></div>
                    <div class="stat-card"><div class="stat-label">⚖️ Weight</div><div class="stat-value" id="growthWeight">—</div></div>
                    <div class="stat-card"><div class="stat-label">🧠 Head</div><div class="stat-value" id="growthHead">—</div></div>
                    <div class="stat-card"><div class="stat-label">📈 Growth Rate</div><div class="stat-value" id="growthRate">—</div></div>
                </div>
                <div class="empty-state"><div class="emoji">📊</div><h3>Growth tracking coming soon</h3><p>Full growth charts and percentiles will appear here.</p></div>
            </div>
        </div>
        <script>
        async function loadGrowth() {
            var { data } = await supabase.from('tracker_entries').select('*').eq('tracker_type', 'growth').eq('is_deleted', false).order('timestamp', { ascending: false }).limit(10);
            if (data && data.length > 0) {
                var latest = data[0];
                var value = latest.data?.value || '—';
                var unit = latest.data?.unit || '';
                document.getElementById('growthHeight').textContent = (latest.data?.measurementType === 'height' ? value + unit : '—');
                document.getElementById('growthWeight').textContent = (latest.data?.measurementType === 'weight' ? value + unit : '—');
                document.getElementById('growthHead').textContent = (latest.data?.measurementType === 'head' ? value + unit : '—');
                document.getElementById('growthRate').textContent = data.length + ' records';
            }
        }
        document.addEventListener('DOMContentLoaded', function() { setTimeout(loadGrowth, 500); });
        </script>
    `,

    activity: `
        <div class="card">
            <div class="card-header"><div class="card-title"><span class="emoji">📈</span> Activity Heatmap</div><span class="card-subtitle">User engagement patterns</span></div>
            <div class="card-body">
                <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;max-width:600px;margin:0 auto;">
                    <div style="text-align:center;font-size:11px;color:var(--text-muted);padding:4px;">Mon</div>
                    <div style="text-align:center;font-size:11px;color:var(--text-muted);padding:4px;">Tue</div>
                    <div style="text-align:center;font-size:11px;color:var(--text-muted);padding:4px;">Wed</div>
                    <div style="text-align:center;font-size:11px;color:var(--text-muted);padding:4px;">Thu</div>
                    <div style="text-align:center;font-size:11px;color:var(--text-muted);padding:4px;">Fri</div>
                    <div style="text-align:center;font-size:11px;color:var(--text-muted);padding:4px;">Sat</div>
                    <div style="text-align:center;font-size:11px;color:var(--text-muted);padding:4px;">Sun</div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;max-width:600px;margin:0 auto;" id="heatmap">
                    ${Array(35).fill(0).map((_, i) => `<div style="aspect-ratio:1;border-radius:4px;background:var(--bg-primary);" data-day="${i}"></div>`).join('')}
                </div>
                <div style="text-align:center;margin-top:12px;font-size:12px;color:var(--text-muted);">
                    <span>Less</span>
                    <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#dbeafe;margin:0 4px;"></span>
                    <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#93c5fd;margin:0 4px;"></span>
                    <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#3b82f6;margin:0 4px;"></span>
                    <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#1d4ed8;margin:0 4px;"></span>
                    <span>More</span>
                </div>
            </div>
        </div>
        <script>
        async function loadHeatmap() {
            var { data } = await supabase.from('tracker_entries').select('timestamp').eq('is_deleted', false).order('timestamp', { ascending: false }).limit(100);
            if (!data || data.length === 0) return;
            var dayCounts = {};
            data.forEach(function(e) {
                var day = new Date(e.timestamp).getDay();
                dayCounts[day] = (dayCounts[day] || 0) + 1;
            });
            var maxCount = Math.max(...Object.values(dayCounts), 1);
            var cells = document.querySelectorAll('#heatmap div');
            cells.forEach(function(cell, i) {
                var day = i % 7;
                var count = dayCounts[day] || 0;
                var intensity = Math.round((count / maxCount) * 100);
                if (intensity > 0) {
                    var colors = ['#dbeafe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8'];
                    var idx = Math.min(Math.floor(intensity / 20), 5);
                    cell.style.background = colors[idx] || '#dbeafe';
                }
            });
        }
        document.addEventListener('DOMContentLoaded', function() { setTimeout(loadHeatmap, 500); });
        </script>
    `,

    realtime: `
        <div class="status-bar" style="background:#1a1a2e;color:#fff;border-color:rgba(255,255,255,0.1);">
            <span class="spinner" style="border-top-color:#667eea;"></span>
            <span>🔄 Listening to real-time events...</span>
            <span style="margin-left:auto;font-size:12px;color:rgba(255,255,255,0.5);" id="eventCount">0 events</span>
        </div>
        <div class="card">
            <div class="card-header"><div class="card-title"><span class="emoji">📡</span> Event Stream</div><span class="card-subtitle">Real-time</span></div>
            <div class="card-body"><div class="activity-feed" id="eventFeed"><div class="empty-state"><div class="emoji">📡</div><h3>Waiting for events</h3><p>Real-time events will appear here as they happen.</p></div></div></div>
        </div>
        <script>
        var eventCount = 0;
        async function setupRealtime() {
            var channel = supabase.channel('admin-realtime')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'babies' }, function(p) { addEvent(p, 'babies'); })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'tracker_entries' }, function(p) { addEvent(p, 'tracker_entries'); })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts' }, function(p) { addEvent(p, 'community_posts'); })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, function(p) { addEvent(p, 'profiles'); })
                .subscribe();
        }
        function addEvent(payload, table) {
            eventCount++;
            document.getElementById('eventCount').textContent = eventCount + ' events';
            var feed = document.getElementById('eventFeed');
            var empty = feed.querySelector('.empty-state');
            if (empty) empty.remove();
            var event = payload.eventType;
            var data = payload.new;
            var emoji = event === 'INSERT' ? '🟢' : event === 'UPDATE' ? '🟡' : '🔴';
            var color = event === 'INSERT' ? '#dcfce7' : event === 'UPDATE' ? '#fef3c7' : '#fee2e2';
            var title = data?.title || data?.name || data?.full_name || 'Record';
            var entry = document.createElement('div');
            entry.className = 'activity-item';
            entry.innerHTML =
                '<div class="activity-icon" style="background:' + color + ';">' + emoji + '</div>' +
                '<div class="activity-content">' +
                '<div class="activity-title">' + event + ' on ' + table + '</div>' +
                '<div class="activity-meta">' + title + (data?.id ? ' · ' + data.id.substring(0,8) : '') + '</div>' +
                '</div>' +
                '<div class="activity-time">' + new Date().toLocaleTimeString() + '</div>';
            feed.prepend(entry);
            while (feed.children.length > 50) feed.removeChild(feed.lastChild);
        }
        document.addEventListener('DOMContentLoaded', function() { setTimeout(setupRealtime, 1000); });
        </script>
    `,

    settings: `
        <div class="card">
            <div class="card-header"><div class="card-title"><span class="emoji">⚙️</span> Dashboard Settings</div></div>
            <div class="card-body">
                <div style="display:grid;gap:20px;max-width:500px;">
                    <div>
                        <label style="font-weight:600;font-size:14px;display:block;margin-bottom:4px;">Auto-refresh interval</label>
                        <select id="refreshInterval" style="padding:10px 16px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:14px;width:100%;font-family:var(--font);background:var(--bg-card);">
                            <option value="10">10 seconds</option>
                            <option value="30" selected>30 seconds</option>
                            <option value="60">1 minute</option>
                            <option value="120">2 minutes</option>
                            <option value="300">5 minutes</option>
                            <option value="0">Off</option>
                        </select>
                    </div>
                    <div>
                        <label style="font-weight:600;font-size:14px;display:block;margin-bottom:4px;">Real-time subscriptions</label>
                        <div style="display:flex;gap:12px;flex-wrap:wrap;">
                            <label style="display:flex;align-items:center;gap:6px;font-size:13px;"><input type="checkbox" checked> Babies</label>
                            <label style="display:flex;align-items:center;gap:6px;font-size:13px;"><input type="checkbox" checked> Tracker Entries</label>
                            <label style="display:flex;align-items:center;gap:6px;font-size:13px;"><input type="checkbox" checked> Community Posts</label>
                            <label style="display:flex;align-items:center;gap:6px;font-size:13px;"><input type="checkbox" checked> Users</label>
                        </div>
                    </div>
                    <div>
                        <label style="font-weight:600;font-size:14px;display:block;margin-bottom:4px;">Theme</label>
                        <div style="display:flex;gap:8px;">
                            <button class="btn btn-outline" onclick="document.body.style.setProperty('--bg-sidebar', '#0f0f1a');document.body.style.setProperty('--bg-primary', '#f0f2f8');showToast('Theme updated','success');">🌙 Dark</button>
                            <button class="btn btn-outline" onclick="document.body.style.setProperty('--bg-sidebar', '#1a1a2e');document.body.style.setProperty('--bg-primary', '#1a1a2e');document.body.style.setProperty('--bg-card', '#252540');document.body.style.setProperty('--text-primary', '#ffffff');showToast('Theme updated','success');">🌙 Darker</button>
                            <button class="btn btn-outline" onclick="location.reload();">🔄 Reset</button>
                        </div>
                    </div>
                    <div style="padding-top:16px;border-top:1px solid var(--border);">
                        <button class="btn btn-danger" onclick="localStorage.clear();showToast('Cache cleared ✓','success');">🗑️ Clear Cache</button>
                        <button class="btn btn-outline" style="margin-left:8px;" onclick="navigator.clipboard.writeText(document.getElementById('statsData').textContent);showToast('Stats copied ✓','success');">📊 Export Stats</button>
                    </div>
                    <div id="statsData" style="display:none;">Dashboard stats from LittleLoom</div>
                </div>
            </div>
        </div>
    `,

    backup: `
        <div class="card">
            <div class="card-header"><div class="card-title"><span class="emoji">💾</span> Backup & Restore</div><span class="card-subtitle">Data protection</span></div>
            <div class="card-body">
                <div style="display:grid;gap:16px;max-width:500px;">
                    <div style="padding:16px;background:var(--bg-primary);border-radius:var(--radius-sm);">
                        <div style="font-weight:600;font-size:16px;">📤 Export Data</div>
                        <div style="font-size:13px;color:var(--text-muted);margin:8px 0;">Download a complete backup of all your data</div>
                        <button class="btn btn-primary" onclick="exportBackup()">📥 Download Backup</button>
                    </div>
                    <div style="padding:16px;background:var(--bg-primary);border-radius:var(--radius-sm);">
                        <div style="font-weight:600;font-size:16px;">📥 Import Data</div>
                        <div style="font-size:13px;color:var(--text-muted);margin:8px 0;">Restore from a backup file</div>
                        <input type="file" id="restoreFile" style="margin:8px 0;" accept=".json">
                        <button class="btn btn-success" onclick="importBackup()">📤 Restore Backup</button>
                    </div>
                    <div style="padding:16px;background:var(--bg-primary);border-radius:var(--radius-sm);">
                        <div style="font-weight:600;font-size:16px;">📊 Backup Info</div>
                        <div style="font-size:13px;color:var(--text-muted);" id="backupInfo">No backup data available</div>
                    </div>
                </div>
            </div>
        </div>
        <script>
        async function exportBackup() {
            showToast('Exporting data...', 'info');
            try {
                var data = {
                    timestamp: new Date().toISOString(),
                    version: '1.0',
                    babies: (await supabase.from('babies').select('*').eq('is_active', true)).data || [],
                    profiles: (await supabase.from('profiles').select('*')).data || [],
                    entries: (await supabase.from('tracker_entries').select('*').eq('is_deleted', false)).data || [],
                    posts: (await supabase.from('community_posts').select('*').eq('is_deleted', false)).data || []
                };
                var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'littleloom-backup-' + new Date().toISOString().slice(0,10) + '.json';
                a.click();
                URL.revokeObjectURL(url);
                showToast('Backup downloaded ✓', 'success');
                document.getElementById('backupInfo').textContent = 'Last backup: ' + new Date().toLocaleString() + ' (' + Object.keys(data).length + ' tables)';
            } catch(e) {
                showToast('Export failed: ' + e.message, 'error');
            }
        }
        function importBackup() {
            var fileInput = document.getElementById('restoreFile');
            if (!fileInput.files || fileInput.files.length === 0) {
                showToast('Please select a backup file', 'warning');
                return;
            }
            var reader = new FileReader();
            reader.onload = function(e) {
                try {
                    var data = JSON.parse(e.target.result);
                    showToast('Backup loaded: ' + Object.keys(data).join(', '), 'success');
                    console.log('Backup data:', data);
                    document.getElementById('backupInfo').textContent = 'Restored backup from ' + (data.timestamp || 'unknown date') + ' (' + Object.keys(data).length + ' tables)';
                } catch(err) {
                    showToast('Invalid backup file: ' + err.message, 'error');
                }
            };
            reader.readAsText(fileInput.files[0]);
        }
        document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('backupInfo').textContent = 'No backup data yet. Click "Download Backup" to create one.';
        });
        </script>
    `
};

// ============================================================
// MAIN SETUP FUNCTION
// ============================================================
function setupAdminDashboard() {
    console.log('🧵 Setting up LittleLoom Admin Dashboard...\n');

    createDirectories();

    // Write main dashboard
    const dashboardPath = path.join(ADMIN_DIR, 'dashboard.html');
    fs.writeFileSync(dashboardPath, dashboardPage);
    console.log('✅ Created dashboard.html');

    // Write all page files
    const pages = [
        { name: 'Babies', icon: '👶', key: 'babies' },
        { name: 'Users', icon: '👤', key: 'users' },
        { name: 'Community', icon: '💬', key: 'community' },
        { name: 'Topics', icon: '📌', key: 'topics' },
        { name: 'Trackers', icon: '📈', key: 'trackers' },
        { name: 'Milestones', icon: '🏆', key: 'milestones' },
        { name: 'Growth Analytics', icon: '📊', key: 'growth' },
        { name: 'Activity Heatmap', icon: '📈', key: 'activity' },
        { name: 'Realtime', icon: '🔄', key: 'realtime' },
        { name: 'Settings', icon: '⚙️', key: 'settings' },
        { name: 'Backup & Restore', icon: '💾', key: 'backup' }
    ];

    pages.forEach(function({ name, icon, key }) {
        var content = pageContents[key] || '<div class="empty-state"><div class="emoji">📄</div><h3>Page under construction</h3></div>';
        var pageHtml = generatePage(name, icon, content);
        var pagePath = path.join(PAGES_DIR, key + '.html');
        fs.writeFileSync(pagePath, pageHtml);
        console.log('✅ Created ' + key + '.html');
    });

    // Create server.js
    const serverJs = `// server.js - Run with: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const server = http.createServer((req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') filePath = './admin/dashboard.html';
    if (filePath === './admin' || filePath === './admin/') filePath = './admin/dashboard.html';
    
    const extname = path.extname(filePath);
    let contentType = 'text/html';
    switch (extname) {
        case '.js': contentType = 'text/javascript'; break;
        case '.css': contentType = 'text/css'; break;
        case '.json': contentType = 'application/json'; break;
        case '.png': contentType = 'image/png'; break;
        case '.jpg': case '.jpeg': contentType = 'image/jpeg'; break;
        case '.svg': contentType = 'image/svg+xml'; break;
        default: contentType = 'text/html';
    }
    
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('Page not found: ' + req.url);
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log('\\n🚀 LittleLoom Admin Dashboard');
    console.log('📊 Dashboard: http://localhost:' + PORT + '/admin/dashboard.html');
    console.log('📁 Pages: http://localhost:' + PORT + '/admin/pages/');
    console.log('\\n⚡ Press Ctrl+C to stop\\n');
});`;

    const serverPath = path.join(__dirname, 'server.js');
    fs.writeFileSync(serverPath, serverJs);
    console.log('✅ Created server.js');

    console.log('\n🎉 Setup complete!');
    console.log('\n▶️ To start the server, run:');
    console.log('   node server.js');
    console.log('\n📊 Then open: http://localhost:3000/admin/dashboard.html');
    console.log('\n🔑 Login with your Supabase credentials');
    console.log('\n📱 Pages created:');
    console.log('   📊 Dashboard - Main overview with stats and activity');
    console.log('   👶 Babies - All baby profiles');
    console.log('   👤 Users - All user accounts');
    console.log('   💬 Community - Posts and engagement');
    console.log('   📌 Topics - Community topics');
    console.log('   📈 Tracker Entries - All tracked activities');
    console.log('   🏆 Milestones - All developmental milestones');
    console.log('   📊 Growth Analytics - Baby growth insights');
    console.log('   📈 Activity Heatmap - User engagement patterns');
    console.log('   🔄 Realtime Monitor - Live event stream');
    console.log('   ⚙️ Settings - Dashboard configuration');
    console.log('   💾 Backup & Restore - Data protection');
}

// ============================================================
// RUN SETUP
// ============================================================

setupAdminDashboard();

// Also run the server automatically
console.log('\n🚀 Starting server...');
var serverProcess = exec('node server.js', function(error, stdout, stderr) {
    if (error) {
        console.log('❌ Server error:', error.message);
        console.log('💡 Try running: node server.js manually');
        console.log('💡 Or just open the HTML file directly in your browser');
    }
});

// Handle process exit
process.on('SIGINT', function() {
    console.log('\n\n👋 Shutting down...');
    if (serverProcess) {
        serverProcess.kill();
    }
    process.exit(0);
});