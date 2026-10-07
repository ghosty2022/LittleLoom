const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;


app.use((req, res, next) => {
    console.log(`📝 ${req.method} ${req.url}`);
    next();
});


app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));


app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'login.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'login.html'));
});


app.get('/', (req, res) => {
    res.redirect('/login');
});

app.get('/admin', (req, res) => {
    res.redirect('/admin/dashboard');
});


app.get('/admin/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/admin/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/dashboard', (req, res) => {
    res.redirect('/admin/dashboard');
});


const PAGE_ROUTES = [
    'babies', 'users', 'moderation', 'community', 'topics', 
    'announcements', 'trackers', 'milestones', 'analytics', 
    'growth', 'activity', 'settings', 'backup', 'audit', 
    'admin_roles', 'support', 'api', 'features', 'export', 
    'health', 'performance', 'qrcode', 'realtime', 'notifications'
];

app.get('/admin/:page', (req, res) => {
    const page = req.params.page;
    
    
    if (page.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        return res.status(404).send('File not found');
    }
    
    if (page === 'dashboard') {
        return res.redirect('/admin/dashboard');
    }
    
    
    if (PAGE_ROUTES.includes(page)) {
        const filePath = path.join(__dirname, 'pages', page + '.html');
        console.log(`📄 Serving page: ${page} from ${filePath}`);
        return res.sendFile(filePath, (err) => {
            if (err) {
                console.log(`❌ Page not found: ${page}`);
                res.redirect('/login');
            }
        });
    }
    
    
    const filePath = path.join(__dirname, 'pages', page + '.html');
    res.sendFile(filePath, (err) => {
        if (err) {
            console.log(`❌ Page not found: ${page}`);
            res.redirect('/login');
        }
    });
});


app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


app.use((req, res) => {
    if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        return res.status(404).send('File not found');
    }
    res.redirect('/login');
});


app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🚀 LittleLoom Admin Dashboard');
    console.log('🔐 Login:  http://localhost:' + PORT + '/login');
    console.log('📊 Dashboard: http://localhost:' + PORT + '/admin/dashboard');
    console.log('👥 Admin Roles: http://localhost:' + PORT + '/admin/admin_roles');
    console.log('📁 Pages: http://localhost:' + PORT + '/admin/:page');
    console.log('');
    console.log('⚡ Press Ctrl+C to stop');
    console.log('');
});