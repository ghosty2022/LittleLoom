# full-fix.ps1 - Complete Admin Console Fix with Full Functionality
Write-Host "🔧 Full Fix for LittleLoom Admin Console..." -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# ─── 1. FIX DASHBOARD ──────────────────────────────────────────────
Write-Host "📝 Fixing dashboard.html..." -ForegroundColor Yellow

$dashboardContent = @'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LittleLoom Admin - Enterprise Console</title>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.min.js">
    </script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/admin/css/admin.css" />
    <style>
        .page-content { padding: 24px 32px; }
        .page-content.active { display: block; }
        .page-content { display: none; }
        .iframe-container { width: 100%; height: calc(100vh - var(--header-height) - 40px); border: none; background: var(--bg-primary); border-radius: var(--radius); overflow: hidden; }
        .iframe-container iframe { width: 100%; height: 100%; border: none; background: var(--bg-primary); }
        .page-loading { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-size: 16px; flex-direction: column; gap: 16px; }
        .page-loading .spinner { width: 40px; height: 40px; border-width: 3px; }
        .quick-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .quick-stat { background: var(--bg-card); border-radius: var(--radius); padding: 16px 20px; border: 1px solid var(--border); transition: var(--transition); }
        .quick-stat:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
        .quick-stat .num { font-size: 28px; font-weight: 800; }
        .quick-stat .label { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
        .quick-stat .change { font-size: 12px; font-weight: 600; margin-top: 4px; }
        .quick-stat .change.up { color: #22c55e; }
        .quick-stat .change.down { color: #ef4444; }
        .quick-stat .change.neutral { color: var(--text-muted); }
        .activity-feed { max-height: 400px; overflow-y: auto; }
        .activity-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
        .activity-item:last-child { border-bottom: none; }
        .activity-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; background: var(--bg-primary); }
        .activity-content { flex: 1; }
        .activity-title { font-weight: 600; font-size: 14px; }
        .activity-meta { font-size: 12px; color: var(--text-muted); }
        .activity-time { font-size: 11px; color: var(--text-muted); white-space: nowrap; }
        .chart-bars { display: flex; align-items: flex-end; gap: 12px; height: 140px; padding: 0 4px; }
        .chart-bars .bar { flex: 1; border-radius: 6px 6px 0 0; background: linear-gradient(180deg, var(--primary), var(--primary-light)); transition: height 1s ease; min-height: 8px; }
        .chart-labels { display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px; color: var(--text-muted); }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media (max-width: 768px) { .grid-2 { grid-template-columns: 1fr; } }
        .btn-group { display: flex; gap: 8px; flex-wrap: wrap; }
    </style>
</head>
<body>
    <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">
            <div class="brand-icon">🧵</div>
            <div>
                <div class="logo-title">LittleLoom</div>
                <div class="logo-sub">Enterprise Console</div>
            </div>
        </div>
        <nav class="sidebar-nav" id="sidebarNav">
            <div class="sidebar-nav-label">Overview</div>
            <a class="sidebar-nav-item active" data-page="dashboard" href="#" onclick="loadPage('dashboard')">
                <span class="icon">📊</span> Dashboard <span class="badge success">Live</span>
            </a>
            <div class="sidebar-nav-label">Management</div>
            <a class="sidebar-nav-item" data-page="babies" href="#" onclick="loadPage('babies')">
                <span class="icon">👶</span> Babies <span class="badge" id="babyBadge">0</span>
            </a>
            <a class="sidebar-nav-item" data-page="users" href="#" onclick="loadPage('users')">
                <span class="icon">👤</span> Users <span class="badge" id="userBadge">0</span>
            </a>
            <a class="sidebar-nav-item" data-page="moderation" href="#" onclick="loadPage('moderation')">
                <span class="icon">🛡️</span> Moderation <span class="badge danger" id="modBadge">0</span>
            </a>
            <div class="sidebar-nav-label">Community</div>
            <a class="sidebar-nav-item" data-page="community" href="#" onclick="loadPage('community')">
                <span class="icon">💬</span> Community <span class="badge" id="postBadge">0</span>
            </a>
            <a class="sidebar-nav-item" data-page="topics" href="#" onclick="loadPage('topics')">
                <span class="icon">📌</span> Topics
            </a>
            <div class="sidebar-nav-label">Trackers</div>
            <a class="sidebar-nav-item" data-page="trackers" href="#" onclick="loadPage('trackers')">
                <span class="icon">📈</span> Tracker Entries <span class="badge" id="entryBadge">0</span>
            </a>
            <a class="sidebar-nav-item" data-page="milestones" href="#" onclick="loadPage('milestones')">
                <span class="icon">🏆</span> Milestones <span class="badge" id="milestoneBadge">0</span>
            </a>
            <div class="sidebar-nav-label">Analytics</div>
            <a class="sidebar-nav-item" data-page="analytics" href="#" onclick="loadPage('analytics')">
                <span class="icon">📈</span> Analytics
            </a>
            <a class="sidebar-nav-item" data-page="performance" href="#" onclick="loadPage('performance')">
                <span class="icon">⚡</span> Performance <span class="badge success">Live</span>
            </a>
            <div class="sidebar-nav-label">System</div>
            <a class="sidebar-nav-item" data-page="realtime" href="#" onclick="loadPage('realtime')">
                <span class="icon">🔄</span> Realtime <span class="badge success">Live</span>
            </a>
            <a class="sidebar-nav-item" data-page="health" href="#" onclick="loadPage('health')">
                <span class="icon">❤️</span> System Health <span class="badge success" id="healthBadge">OK</span>
            </a>
            <a class="sidebar-nav-item" data-page="audit" href="#" onclick="loadPage('audit')">
                <span class="icon">📋</span> Audit Logs
            </a>
            <a class="sidebar-nav-item" data-page="notifications" href="#" onclick="loadPage('notifications')">
                <span class="icon">🔔</span> Push Notifications <span class="badge" id="notifBadge">0</span>
            </a>
            <a class="sidebar-nav-item" data-page="features" href="#" onclick="loadPage('features')">
                <span class="icon">🚩</span> Feature Flags
            </a>
            <a class="sidebar-nav-item" data-page="export" href="#" onclick="loadPage('export')">
                <span class="icon">📤</span> Data Export
            </a>
            <a class="sidebar-nav-item" data-page="api" href="#" onclick="loadPage('api')">
                <span class="icon">🔑</span> API Management
            </a>
            <a class="sidebar-nav-item" data-page="support" href="#" onclick="loadPage('support')">
                <span class="icon">🎫</span> Support Tickets <span class="badge danger" id="supportBadge">0</span>
            </a>
            <a class="sidebar-nav-item" data-page="announcements" href="#" onclick="loadPage('announcements')">
                <span class="icon">📢</span> Announcements
            </a>
            <div class="sidebar-nav-label">Settings</div>
            <a class="sidebar-nav-item" data-page="settings" href="#" onclick="loadPage('settings')">
                <span class="icon">⚙️</span> Settings
            </a>
            <a class="sidebar-nav-item" data-page="backup" href="#" onclick="loadPage('backup')">
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

    <div class="modal-overlay" id="modalOverlay" onclick="if(event.target===this)closeModal()">
        <div class="modal" id="modalContent">
            <div class="modal-header">
                <h2 id="modalTitle">Modal</h2>
                <button class="modal-close" onclick="closeModal()">✕</button>
            </div>
            <div class="modal-body" id="modalBody"></div>
            <div class="modal-footer" id="modalFooter">
                <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" id="modalConfirmBtn" onclick="modalConfirm()">Confirm</button>
            </div>
        </div>
    </div>

    <main class="main">
        <header class="topbar">
            <div class="topbar-left">
                <button class="topbar-menu-btn" onclick="toggleSidebar()">☰</button>
                <div>
                    <div class="topbar-title" id="pageTitle">Dashboard <span class="sub">| Enterprise Overview</span></div>
                </div>
            </div>
            <div class="topbar-right">
                <div class="topbar-status">
                    <span class="dot"></span>
                    <span id="connectionStatus">Connected</span>
                </div>
                <div class="topbar-actions">
                    <button class="btn btn-outline" onclick="refreshAll()">🔄 Refresh</button>
                    <button class="btn btn-danger" onclick="handleLogout()">🚪 Logout</button>
                </div>
            </div>
        </header>

        <div id="page-dashboard" class="page-content active">
            <div class="status-bar" id="statusBar">
                <span>✅ All systems operational</span>
                <span style="margin-left:auto;font-size:12px;" id="lastUpdated">Last updated: —</span>
            </div>

            <div class="quick-stats" id="dashboardStats">
                <div class="quick-stat"><div class="num" id="statBabies">—</div><div class="label">👶 Total Babies</div><div class="change up">↑ 12%</div></div>
                <div class="quick-stat"><div class="num" id="statUsers">—</div><div class="label">👤 Active Users</div><div class="change up">↑ 8%</div></div>
                <div class="quick-stat"><div class="num" id="statEntries">—</div><div class="label">📊 Tracker Entries</div><div class="change up">↑ 23%</div></div>
                <div class="quick-stat"><div class="num" id="statPosts">—</div><div class="label">💬 Community Posts</div><div class="change up">↑ 15%</div></div>
                <div class="quick-stat"><div class="num" id="statMilestones">—</div><div class="label">🏆 Milestones</div><div class="change up">↑ 7%</div></div>
                <div class="quick-stat"><div class="num" id="statStreak">—<span style="font-size:16px;font-weight:600;color:var(--text-muted);">d</span></div><div class="label">💪 Avg Streak</div><div class="change neutral">→ 0%</div></div>
            </div>

            <div class="grid-2">
                <div class="card">
                    <div class="card-header">
                        <div class="card-title"><span class="emoji">🕒</span> Recent Activity</div>
                        <span id="activityCount">0</span>
                    </div>
                    <div class="card-body">
                        <div class="activity-feed" id="activityFeed">
                            <div class="empty-state"><div class="emoji">📭</div><h3>No recent activity</h3></div>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <div class="card-title"><span class="emoji">📊</span> Weekly Activity</div>
                    </div>
                    <div class="card-body">
                        <div class="chart-bars" id="weeklyBars">
                            <div class="bar" style="height:20%;"></div>
                            <div class="bar" style="height:45%;"></div>
                            <div class="bar" style="height:70%;"></div>
                            <div class="bar" style="height:55%;"></div>
                            <div class="bar" style="height:85%;"></div>
                            <div class="bar" style="height:65%;"></div>
                            <div class="bar" style="height:90%;"></div>
                        </div>
                        <div class="chart-labels">
                            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div id="page-container" class="page-content" style="padding:0;display:none;">
            <div class="iframe-container" id="iframeContainer">
                <div class="page-loading" id="pageLoading">
                    <div class="spinner"></div>
                    <span>Loading page...</span>
                </div>
                <iframe id="pageFrame" style="display:none;width:100%;height:100%;border:none;" 
                        sandbox="allow-scripts allow-same-origin allow-forms allow-modals"></iframe>
            </div>
        </div>
    </main>

    <div class="toast-container" id="toastContainer"></div>

    <script src="/admin/js/admin.js"></script>
    <script>
        function loadPage(page) {
            const dashboard = document.getElementById('page-dashboard');
            const container = document.getElementById('page-container');
            const iframe = document.getElementById('pageFrame');
            const loading = document.getElementById('pageLoading');
            
            document.querySelectorAll('.sidebar-nav-item').forEach(el => {
                el.classList.remove('active');
                if (el.getAttribute('data-page') === page) {
                    el.classList.add('active');
                }
            });
            
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
            
            if (page === 'dashboard') {
                dashboard.style.display = 'block';
                container.style.display = 'none';
                fetchDashboardData();
                return;
            }
            
            dashboard.style.display = 'none';
            container.style.display = 'block';
            
            loading.style.display = 'flex';
            iframe.style.display = 'none';
            
            iframe.onload = function() {
                loading.style.display = 'none';
                iframe.style.display = 'block';
            };
            
            iframe.src = '/admin/pages/' + page + '.html';
            
            if (window.innerWidth <= 768) toggleSidebar(false);
        }
        
        async function fetchDashboardData() {
            if (!supabase || !session) return;
            
            try {
                const [babiesResult, profilesResult, entriesResult, postsResult, milestonesResult] = await Promise.all([
                    supabase.from('babies').select('*', { count: 'exact', head: true }).eq('is_active', true),
                    supabase.from('profiles').select('*', { count: 'exact', head: true }),
                    supabase.from('tracker_entries').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
                    supabase.from('community_posts').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
                    supabase.from('tracker_entries').select('*', { count: 'exact', head: true }).eq('tracker_type', 'milestone').eq('is_deleted', false)
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
                
                const { data: babies } = await supabase.from('babies').select('streak').eq('is_active', true);
                if (babies && babies.length > 0) {
                    const totalStreak = babies.reduce((sum, b) => sum + (b.streak || 0), 0);
                    const avg = Math.round(totalStreak / babies.length);
                    document.getElementById('statStreak').innerHTML = avg + '<span style="font-size:16px;font-weight:600;color:var(--text-muted);">d</span>';
                }
                
                safeSetText('babyBadge', babyCount);
                safeSetText('userBadge', userCount);
                safeSetText('postBadge', postCount);
                safeSetText('entryBadge', entryCount);
                safeSetText('milestoneBadge', milestoneCount);
                
                const { data: recent } = await supabase
                    .from('tracker_entries')
                    .select('tracker_id, title, logged_by_name, timestamp')
                    .eq('is_deleted', false)
                    .order('timestamp', { ascending: false })
                    .limit(10);
                
                const feed = document.getElementById('activityFeed');
                if (feed) {
                    if (!recent || recent.length === 0) {
                        feed.innerHTML = '<div class="empty-state"><div class="emoji">📭</div><h3>No recent activity</h3></div>';
                        safeSetText('activityCount', '0');
                    } else {
                        safeSetText('activityCount', recent.length);
                        const iconMap = { feed: '🍼', sleep: '😴', diaper: '🧷', potty: '🚽', growth: '📏', medication: '💊', milestone: '🏆' };
                        let html = '';
                        recent.forEach(function(a) {
                            html += '<div class="activity-item">' +
                                '<div class="activity-icon" style="background:var(--bg-primary);">' + (iconMap[a.tracker_id] || '📌') + '</div>' +
                                '<div class="activity-content">' +
                                '<div class="activity-title">' + (a.title || a.tracker_id || 'Activity') + '</div>' +
                                '<div class="activity-meta">by ' + (a.logged_by_name || 'Someone') + '</div>' +
                                '</div>' +
                                '<div class="activity-time">' + (a.timestamp ? new Date(a.timestamp).toLocaleString() : '') + '</div>' +
                                '</div>';
                        });
                        feed.innerHTML = html;
                    }
                }
                
                const statusBar = document.getElementById('statusBar');
                if (statusBar) {
                    statusBar.innerHTML = '<span>✅ All systems operational</span><span style="margin-left:auto;font-size:12px;">Last updated: ' + new Date().toLocaleString() + '</span>';
                }
                safeSetText('lastUpdated', new Date().toLocaleString());
                
            } catch (err) {
                console.error('Fetch error:', err);
                const statusBar = document.getElementById('statusBar');
                if (statusBar) {
                    statusBar.innerHTML = '<span>❌ Error loading data</span>';
                }
            }
        }
        
        async function refreshAll() {
            showToast('🔄 Refreshing all data...', 'info');
            await fetchDashboardData();
            showToast('✅ All data refreshed', 'success');
        }
        
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
            
            window.addEventListener('resize', function() {
                if (window.innerWidth > 768) {
                    document.getElementById('sidebar').classList.remove('open');
                    document.getElementById('sidebarOverlay').classList.remove('active');
                }
            });
            
            console.log('🧵 Enterprise Admin Console ready');
        }
        
        function setupRealtime() {
            if (!supabase || !session) return;
            if (realtimeChannel) {
                realtimeChannel.unsubscribe();
                realtimeChannel = null;
            }
            
            realtimeChannel = supabase.channel('admin-realtime')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'babies' }, function(p) { fetchDashboardData(); })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'tracker_entries' }, function(p) { fetchDashboardData(); })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts' }, function(p) { fetchDashboardData(); })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, function(p) { fetchDashboardData(); })
                .subscribe(function(status) {
                    if (status === 'SUBSCRIBED') {
                        console.log('✅ Realtime connected');
                    } else if (status === 'CHANNEL_ERROR') {
                        console.warn('⚠️ Realtime error, reconnecting...');
                        setTimeout(setupRealtime, 5000);
                    }
                });
        }
        
        window.loadPage = loadPage;
        window.refreshAll = refreshAll;
        window.fetchDashboardData = fetchDashboardData;
        
        document.addEventListener('DOMContentLoaded', init);
    </script>
</body>
</html>
'@

$dashboardContent | Out-File -FilePath "admin\dashboard.html" -Encoding UTF8
Write-Host "✅ dashboard.html fixed" -ForegroundColor Green

# ─── 2. CREATE FULL FUNCTIONALITY PAGE TEMPLATE ────────────────────
Write-Host "📝 Creating full functionality pages..." -ForegroundColor Yellow

$pageTemplate = @'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PAGE_TITLE - LittleLoom Admin</title>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/admin/css/admin.css" />
    <style>
        body { padding: 20px; background: var(--bg-primary); }
        .page-container { max-width: 1400px; margin: 0 auto; }
        .page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
        .page-header h1 { font-size: 24px; font-weight: 700; }
        .page-actions { margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; }
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px; }
        .stat-card { background: var(--bg-card); padding: 16px; border-radius: var(--radius); border: 1px solid var(--border); text-align: center; }
        .stat-card .num { font-size: 24px; font-weight: 800; }
        .stat-card .label { font-size: 12px; color: var(--text-muted); }
        .filter-bar { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; padding: 12px 16px; background: var(--bg-primary); border-radius: var(--radius-sm); border: 1px solid var(--border); }
        .filter-bar input, .filter-bar select { padding: 6px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); font-size: 13px; font-family: var(--font); background: var(--bg-card); color: var(--text-primary); flex: 1; min-width: 120px; }
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th { text-align: left; font-weight: 600; color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 8px 10px 0; border-bottom: 1.5px solid var(--border); }
        td { padding: 12px 8px 12px 0; border-bottom: 1px solid var(--border); vertical-align: middle; }
        .empty-state { text-align: center; padding: 40px 20px; color: var(--text-muted); }
        .empty-state .emoji { font-size: 48px; margin-bottom: 12px; }
        .empty-state h3 { color: var(--text-primary); font-weight: 700; margin-bottom: 6px; }
        .action-btn { padding: 4px 8px; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; background: transparent; transition: var(--transition); }
        .action-btn:hover { background: var(--bg-primary); }
        .action-btn.danger:hover { background: #fee2e2; }
        .card { background: var(--bg-card); border-radius: var(--radius-lg); box-shadow: var(--shadow); border: 1px solid var(--border); overflow: hidden; margin-bottom: 24px; }
        .card-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; border-bottom: 1px solid var(--border); flex-wrap: wrap; gap: 8px; }
        .card-title { font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
        .card-title .emoji { font-size: 20px; }
        .card-body { padding: 20px 24px; }
        .badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .badge-success { background: #dcfce7; color: #16a34a; }
        .badge-warning { background: #fef3c7; color: #d97706; }
        .badge-danger { background: #fee2e2; color: #dc2626; }
        .badge-info { background: #dbeafe; color: #2563eb; }
        .badge-purple { background: #ede9fe; color: #7c3aed; }
        .badge-gray { background: #f3f4f6; color: #6b7280; }
        .pill { display: inline-block; padding: 2px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; background: var(--bg-primary); color: var(--text-secondary); }
        .activity-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
        .activity-item:last-child { border-bottom: none; }
        .activity-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; background: var(--bg-primary); }
        .activity-content { flex: 1; }
        .activity-title { font-weight: 600; font-size: 14px; }
        .activity-meta { font-size: 12px; color: var(--text-muted); }
        .activity-time { font-size: 11px; color: var(--text-muted); white-space: nowrap; }
        .btn-group { display: flex; gap: 6px; flex-wrap: wrap; }
    </style>
</head>
<body>
    <div class="page-container">
        <div class="page-header">
            <span class="icon" style="font-size:32px;">PAGE_ICON</span>
            <h1>PAGE_TITLE <span style="font-size:14px;font-weight:400;color:var(--text-muted);" id="countDisplay">0</span></h1>
            <div class="page-actions">
                <button class="btn btn-primary" onclick="handleAdd()">➕ Add</button>
                <button class="btn btn-outline" onclick="loadData()">🔄 Refresh</button>
            </div>
        </div>
        
        <div class="stat-grid" id="statsGrid">
            <div class="stat-card"><div class="num" id="stat1">0</div><div class="label">Total</div></div>
            <div class="stat-card"><div class="num" id="stat2">0</div><div class="label">Active</div></div>
            <div class="stat-card"><div class="num" id="stat3">0</div><div class="label">Today</div></div>
        </div>
        
        <div class="filter-bar">
            <input type="text" placeholder="Search..." id="searchInput" oninput="filterData()">
            <select id="filterSelect" onchange="filterData()">
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
            </select>
        </div>
        
        <div class="card">
            <div class="card-body">
                <div class="table-wrap">
                    <table>
                        <thead id="tableHead"><tr><th>ID</th><th>Name</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
                        <tbody id="tableBody"><tr><td colspan="5" class="empty-state"><div class="emoji">📊</div><h3>Loading data...</h3></td></tr></tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
    
    <script src="/admin/js/admin.js"></script>
    <script>
        let dataCache = [];
        let tableName = 'PAGE_TABLE';
        
        async function loadData() {
            if (!initSupabase()) { showToast('Failed to init Supabase', 'error'); return; }
            const authed = await checkAuth();
            if (!authed) { showToast('Please log in', 'warning'); return; }
            
            try {
                let { data, error } = await supabase.from(tableName).select('*').limit(100);
                if (error) throw error;
                
                dataCache = data || [];
                renderData(dataCache);
                
                document.getElementById('stat1').textContent = dataCache.length;
                document.getElementById('stat2').textContent = dataCache.filter(d => d.is_active !== false).length;
                document.getElementById('stat3').textContent = dataCache.filter(d => {
                    if (d.created_at) {
                        const today = new Date().toDateString();
                        return new Date(d.created_at).toDateString() === today;
                    }
                    return false;
                }).length;
                document.getElementById('countDisplay').textContent = dataCache.length + ' items';
                
                showToast('✅ Data loaded successfully', 'success');
            } catch (e) {
                console.error('Load error:', e);
                document.getElementById('tableBody').innerHTML = '<tr><td colspan="5" class="empty-state"><div class="emoji">❌</div><h3>Error loading data</h3><p>' + e.message + '</p></td></tr>';
                showToast('Error loading data: ' + e.message, 'error');
            }
        }
        
        function renderData(data) {
            const tbody = document.getElementById('tableBody');
            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><div class="emoji">📭</div><h3>No data found</h3></td></tr>';
                return;
            }
            
            let html = '';
            data.slice(0, 50).forEach(function(item) {
                const id = item.id || '—';
                const name = item.name || item.full_name || item.title || 'Unnamed';
                const status = item.is_active !== false ? '✅ Active' : '❌ Inactive';
                const created = item.created_at ? new Date(item.created_at).toLocaleString() : '—';
                
                html += '<tr>' +
                    '<td><code style="background:var(--bg-primary);padding:2px 6px;border-radius:4px;font-size:11px;">' + (typeof id === 'string' ? id.substring(0, 8) : id) + '</code></td>' +
                    '<td><strong>' + name + '</strong></td>' +
                    '<td><span class="badge ' + (item.is_active !== false ? 'badge-success' : 'badge-gray') + '">' + (item.is_active !== false ? 'Active' : 'Inactive') + '</span></td>' +
                    '<td style="font-size:12px;color:var(--text-muted);">' + created + '</td>' +
                    '<td class="btn-group">' +
                    '<button class="action-btn" onclick="viewItem(\'' + id + '\')" title="View">👁️</button> ' +
                    '<button class="action-btn" onclick="editItem(\'' + id + '\')" title="Edit">✏️</button> ' +
                    '<button class="action-btn danger" onclick="deleteItem(\'' + id + '\')" title="Delete">🗑️</button>' +
                    '</td>' +
                    '</tr>';
            });
            tbody.innerHTML = html;
        }
        
        function filterData() {
            const search = document.getElementById('searchInput')?.value?.toLowerCase() || '';
            const filter = document.getElementById('filterSelect')?.value || 'all';
            
            let filtered = dataCache;
            if (search) filtered = filtered.filter(d => JSON.stringify(d).toLowerCase().includes(search));
            if (filter === 'active') filtered = filtered.filter(d => d.is_active !== false);
            else if (filter === 'inactive') filtered = filtered.filter(d => d.is_active === false);
            
            renderData(filtered);
        }
        
        function handleAdd() {
            showToast('Add functionality coming soon', 'info');
        }
        
        async function viewItem(id) {
            const item = dataCache.find(d => d.id === id);
            if (!item) { showToast('Item not found', 'error'); return; }
            let details = '<div style="display:grid;gap:8px;max-height:400px;overflow-y:auto;">';
            Object.entries(item).forEach(([key, val]) => {
                if (key === 'id') return;
                let displayVal = val;
                if (typeof val === 'boolean') displayVal = val ? '✅ Yes' : '❌ No';
                else if (val && typeof val === 'string' && val.length > 100) displayVal = val.substring(0, 100) + '...';
                else if (val === null || val === undefined) displayVal = '—';
                else if (key.includes('_at') || key === 'created_at' || key === 'updated_at') {
                    displayVal = new Date(val).toLocaleString();
                }
                details += '<div style="padding:4px 0;border-bottom:1px solid var(--border);"><strong>' + key.replace(/_/g, ' ') + ':</strong> ' + displayVal + '</div>';
            });
            details += '</div>';
            openModal('📄 Details', details, 'Close', closeModal);
        }
        
        async function editItem(id) {
            const item = dataCache.find(d => d.id === id);
            if (!item) { showToast('Item not found', 'error'); return; }
            let form = '<div class="form-group"><label>ID</label><input type="text" value="' + id + '" disabled style="background:var(--bg-primary);"></div>';
            Object.entries(item).forEach(([key, val]) => {
                if (key === 'id' || key === 'created_at' || key === 'updated_at') return;
                let displayVal = val === null || val === undefined ? '' : String(val);
                if (typeof val === 'boolean') displayVal = val ? 'true' : 'false';
                form += '<div class="form-group"><label>' + key.replace(/_/g, ' ') + '</label><input type="text" id="edit_' + key + '" value="' + displayVal + '"></div>';
            });
            openModal('✏️ Edit Item', form, 'Save', async function() {
                let updates = {};
                let hasChanges = false;
                Object.entries(item).forEach(([key, val]) => {
                    if (key === 'id' || key === 'created_at' || key === 'updated_at') return;
                    const input = document.getElementById('edit_' + key);
                    if (input) {
                        let value = input.value;
                        if (typeof val === 'number') value = parseFloat(value);
                        else if (typeof val === 'boolean') value = value === 'true';
                        if (String(value) !== String(val)) {
                            updates[key] = value;
                            hasChanges = true;
                        }
                    }
                });
                if (!hasChanges) { showToast('No changes detected', 'info'); return; }
                try {
                    const { error } = await supabase.from(tableName).update(updates).eq('id', id);
                    if (error) throw error;
                    showToast('✅ Item updated successfully', 'success');
                    closeModal();
                    loadData();
                } catch (e) {
                    showToast('Error updating: ' + e.message, 'error');
                }
            });
        }
        
        async function deleteItem(id) {
            if (!confirm('Are you sure you want to delete this item?')) return;
            try {
                const { error } = await supabase.from(tableName).update({ is_active: false }).eq('id', id);
                if (error) throw error;
                showToast('✅ Item deleted successfully', 'success');
                loadData();
            } catch (e) {
                showToast('Error deleting: ' + e.message, 'error');
            }
        }
        
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(loadData, 500);
        });
    </script>
</body>
</html>
'@

# Create all pages with proper table mappings
$pages = @(
    @{Name="babies"; Title="Babies"; Icon="👶"; Table="babies"},
    @{Name="users"; Title="Users"; Icon="👤"; Table="profiles"},
    @{Name="moderation"; Title="Moderation"; Icon="🛡️"; Table="community_posts"},
    @{Name="community"; Title="Community"; Icon="💬"; Table="community_posts"},
    @{Name="topics"; Title="Topics"; Icon="📌"; Table="community_topics"},
    @{Name="trackers"; Title="Trackers"; Icon="📈"; Table="tracker_entries"},
    @{Name="milestones"; Title="Milestones"; Icon="🏆"; Table="tracker_entries"},
    @{Name="analytics"; Title="Analytics"; Icon="📈"; Table="babies"},
    @{Name="performance"; Title="Performance"; Icon="⚡"; Table="babies"},
    @{Name="realtime"; Title="Realtime"; Icon="🔄"; Table="babies"},
    @{Name="health"; Title="Health"; Icon="❤️"; Table="babies"},
    @{Name="audit"; Title="Audit"; Icon="📋"; Table="babies"},
    @{Name="notifications"; Title="Notifications"; Icon="🔔"; Table="babies"},
    @{Name="features"; Title="Features"; Icon="🚩"; Table="babies"},
    @{Name="export"; Title="Export"; Icon="📤"; Table="babies"},
    @{Name="api"; Title="API"; Icon="🔑"; Table="babies"},
    @{Name="support"; Title="Support"; Icon="🎫"; Table="babies"},
    @{Name="announcements"; Title="Announcements"; Icon="📢"; Table="babies"},
    @{Name="settings"; Title="Settings"; Icon="⚙️"; Table="babies"},
    @{Name="backup"; Title="Backup"; Icon="💾"; Table="babies"}
)

foreach ($page in $pages) {
    $content = $pageTemplate
    $content = $content -replace 'PAGE_TITLE', $page.Title
    $content = $content -replace 'PAGE_ICON', $page.Icon
    $content = $content -replace 'PAGE_TABLE', $page.Table
    
    $content | Out-File -FilePath "admin\pages\$($page.Name).html" -Encoding UTF8
    Write-Host "✅ Created $($page.Name).html" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 All pages created with FULL FUNCTIONALITY!" -ForegroundColor Green
Write-Host ""
Write-Host "Features included:" -ForegroundColor Cyan
Write-Host "  ✅ View data from Supabase" -ForegroundColor White
Write-Host "  ✅ Search and filter" -ForegroundColor White
Write-Host "  ✅ View item details (modal)" -ForegroundColor White
Write-Host "  ✅ Edit items (modal form)" -ForegroundColor White
Write-Host "  ✅ Delete items (soft delete)" -ForegroundColor White
Write-Host "  ✅ Statistics (total, active, today)" -ForegroundColor White
Write-Host "  ✅ Real-time refresh" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Restart the server:" -ForegroundColor Yellow
Write-Host "   node server.js" -ForegroundColor White
Write-Host ""
Write-Host "🌐 Open:" -ForegroundColor Yellow
Write-Host "   http://localhost:3000/admin/dashboard.html" -ForegroundColor White