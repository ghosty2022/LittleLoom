const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to log requests
app.use((req, res, next) => {
    console.log(`📝 ${req.method} ${req.url}`);
    next();
});

// ─── STATIC FILES ──────────────────────────────────────────────
// Serve static files directly from the admin folder
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// ─── LOGIN ROUTE ──────────────────────────────────────────────
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages/login.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages/login.html'));
});

// ─── MAIN ROUTES ──────────────────────────────────────────────
app.get('/', (req, res) => {
    res.redirect('/login');
});

app.get('/admin', (req, res) => {
    res.redirect('/admin/dashboard');
});

// ─── DASHBOARD ROUTES ──────────────────────────────────────────
app.get('/admin/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/admin/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/dashboard', (req, res) => {
    res.redirect('/admin/dashboard');
});

// ─── PAGE ROUTES ──────────────────────────────────────────────
// Handle /admin/:page (direct access)
app.get('/admin/:page', (req, res) => {
    const page = req.params.page;
    
    // Skip if it's a static file
    if (page.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        return res.status(404).send('File not found');
    }
    
    // If it's dashboard, redirect
    if (page === 'dashboard') {
        return res.redirect('/admin/dashboard');
    }
    
    // Otherwise serve the page from /pages
    const filePath = path.join(__dirname, 'pages', page + '.html');
    res.sendFile(filePath, (err) => {
        if (err) {
            console.log(`❌ Page not found: ${page}`);
            res.redirect('/login');
        }
    });
});

// ─── API ROUTES ────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 HANDLER ────────────────────────────────────────────────
app.use((req, res) => {
    // Don't redirect if it's a static asset
    if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        return res.status(404).send('File not found');
    }
    // Redirect to login for unknown routes
    res.redirect('/login');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🚀 LittleLoom Admin Dashboard');
    console.log('🔐 Login:  http://localhost:' + PORT + '/login');
    console.log('📊 Dashboard: http://localhost:' + PORT + '/admin/dashboard');
    console.log('📁 Pages: http://localhost:' + PORT + '/admin/:page (e.g., /admin/babies)');
    console.log('');
    console.log('⚡ Press Ctrl+C to stop');
    console.log('');
});