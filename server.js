const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Serve static files with proper MIME types
app.use('/admin', express.static(path.join(__dirname, 'admin'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
        if (path.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html');
        }
    }
}));

app.use('/admin/css', express.static(path.join(__dirname, 'admin/css')));
app.use('/admin/js', express.static(path.join(__dirname, 'admin/js')));
app.use('/admin/pages', express.static(path.join(__dirname, 'admin/pages')));

// ─── LOGIN ROUTE ──────────────────────────────────────────────
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin/pages/login.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin/pages/login.html'));
});

// ─── MAIN ROUTES ──────────────────────────────────────────────
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

app.get('/admin', (req, res) => {
    res.redirect('/admin/dashboard.html');
});

app.get('/admin/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin/dashboard.html'));
});

app.get('/admin/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin/dashboard.html'));
});

// Handle direct page navigation
app.get('/admin/pages/:page', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin/pages', req.params.page));
});

app.get('/admin/pages/:page.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin/pages', req.params.page + '.html'));
});

// Handle root page without extension
app.get('/admin/:page', (req, res) => {
    if (req.params.page === 'dashboard') {
        res.sendFile(path.join(__dirname, 'admin/dashboard.html'));
    } else {
        res.sendFile(path.join(__dirname, 'admin/pages', req.params.page + '.html'));
    }
});

// ─── CATCH-ALL ──────────────────────────────────────────────────
app.get('*', (req, res) => {
    res.redirect('/login.html');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🚀 LittleLoom Admin Dashboard');
    console.log('🔐 Login:  http://localhost:3000/login.html');
    console.log('📊 Dashboard: http://localhost:3000/admin/dashboard.html');
    console.log('📁 Pages: http://localhost:3000/admin/pages/');
    console.log('\n⚡ Press Ctrl+C to stop\n');
});