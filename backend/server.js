const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── MIDDLEWARE ───
app.use(cors({
  origin: 'http://localhost:5000',
  credentials: true  // ← WICHTIG für Cookies!
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());  // ← NEU

// ─── ROUTES ───
const authRoutes = require('./routes/auth');
const protectedRoutes = require('./routes/protected');
const shopRoutes = require('./routes/shop');
const adminRoutes = require('./routes/admin');
const profileRoutes = require('./routes/profile');

app.use('/api/auth', authRoutes);
app.use('/api/protected', protectedRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);

// ─── STATIC FRONTEND ───
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── FALLBACK ───
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// ─── DB INIT ───
const DB_DIR = path.join(__dirname, 'db');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR);
}

const USERS_PATH = path.join(DB_DIR, 'users.json');
if (!fs.existsSync(USERS_PATH)) {
  fs.writeFileSync(USERS_PATH, JSON.stringify([]), 'utf-8');
}

const SHOP_PATH = path.join(DB_DIR, 'shop.json');
if (!fs.existsSync(SHOP_PATH)) {
  fs.writeFileSync(SHOP_PATH, JSON.stringify([]), 'utf-8');
}

app.listen(PORT, () => {
  console.log(`⚡ VoltX Backend läuft auf http://localhost:${PORT}`);
});