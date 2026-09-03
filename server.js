// server.js - Run with: node server.js
const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname)));
app.listen(PORT, () => {
    console.log(`Admin dashboard running at http://localhost:${PORT}/admin/dashboard.html`);
});