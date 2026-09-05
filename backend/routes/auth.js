const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const DB_PATH = path.join(__dirname, '../db/users.json');
const JWT_SECRET = 'voltX_super_secret_2026';

// ─── ADMIN HART GECODET ───
const ADMIN_USERNAME = 'LucaPicassu';

function readDB() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    if (!data || data.trim() === '') return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── REGISTER ───
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Alle Felder ausfüllen.' });
    }
    if (username.length < 3 || password.length < 4) {
      return res.status(400).json({ success: false, message: 'User mind. 3, Passwort mind. 4 Zeichen.' });
    }

    const users = readDB();
    if (users.find(u => u.username === username)) {
      return res.status(409).json({ success: false, message: 'Benutzername bereits vergeben.' });
    }
    if (users.find(u => u.email === email)) {
      return res.status(409).json({ success: false, message: 'E-Mail bereits registriert.' });
    }

    const isAdmin = (username === ADMIN_USERNAME);
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: uuidv4(),
      username,
      email,
      password: hashedPassword,
      voltCoins: isAdmin ? 9999 : 100,
      createdAt: new Date().toISOString(),
      profile: {
        bio: isAdmin ? '⚡ VoltX Admin' : '',
        avatar: '',
        lastNameChange: null,
        lastDailyBonus: null,
        totalBonus: 0,
        lastActivity: new Date().toISOString()
      },
      transactions: []
    };
    users.push(newUser);
    writeDB(users);

    const token = jwt.sign({ id: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '7d' });

    // ─── TOKEN IN HTTPONLY COOKIE ───
    res.cookie('token', token, {
      httpOnly: true,        // ✅ Nicht mit JavaScript lesbar
      secure: false,         // ✅ Auf true setzen bei HTTPS
      sameSite: 'lax',       // ✅ CSRF-Schutz
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 Tage
    });

    res.status(201).json({
      success: true,
      message: 'Registrierung erfolgreich!',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        voltCoins: newUser.voltCoins,
        isAdmin: isAdmin
      }
    });
  } catch (error) {
    console.error('Register Error:', error);
    res.status(500).json({ success: false, message: 'Serverfehler.' });
  }
});

// ─── LOGIN ───
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Bitte Benutzername und Passwort eingeben.' });
    }

    const users = readDB();
    const user = users.find(u => u.username === username);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Ungültige Anmeldedaten.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Ungültige Anmeldedaten.' });
    }

    // ─── LAST ACTIVITY AKTUALISIEREN ───
    if (!user.profile) user.profile = {};
    user.profile.lastActivity = new Date().toISOString();
    writeDB(users);

    const isAdmin = (username === ADMIN_USERNAME);
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    // ─── TOKEN IN HTTPONLY COOKIE ───
    res.cookie('token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      message: 'Login erfolgreich!',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        voltCoins: user.voltCoins,
        isAdmin: isAdmin
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, message: 'Serverfehler.' });
  }
});

// ─── LOGOUT ───
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logout erfolgreich!' });
});

module.exports = router;