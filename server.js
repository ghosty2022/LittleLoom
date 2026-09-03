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

// Main route
app.get('/', (req, res) => {
    res.redirect('/admin/dashboard.html');
});

// Admin routes
app.get('/admin', (req, res) => {
    res.redirect('/admin/dashboard.html');
});

// Handle direct page navigation
app.get('/admin/pages/:page', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin/pages', req.params.page));
});

// Handle root page without extension
app.get('/admin/:page', (req, res) => {
    if (req.params.page === 'dashboard') {
        res.sendFile(path.join(__dirname, 'admin/dashboard.html'));
    } else {
        res.sendFile(path.join(__dirname, 'admin/pages', req.params.page + '.html'));
    }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🚀 LittleLoom Admin Dashboard');
    console.log('📊 Dashboard: http://localhost:3000/admin/dashboard.html');
    console.log('📁 Pages: http://localhost:3000/admin/pages/');
    console.log('\n⚡ Press Ctrl+C to stop\n');
});