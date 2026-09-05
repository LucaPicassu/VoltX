const express = require('express');
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const DB_PATH = path.join(__dirname, '../db/users.json');

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

// ─── DASHBOARD ───
router.get('/dashboard', authMiddleware, (req, res) => {
  try {
    const users = readDB();
    const userIndex = users.findIndex(u => u.id === req.user.id);
    if (userIndex === -1) return res.status(404).json({ success: false, message: 'User nicht gefunden.' });
    
    const now = new Date().toISOString();
    if (!users[userIndex].profile) users[userIndex].profile = {};
    users[userIndex].profile.lastActivity = now;
    writeDB(users);

    const user = users[userIndex];
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        voltCoins: user.voltCoins,
        createdAt: user.createdAt,
        bio: user.profile?.bio || '',
        avatar: user.profile?.avatar || '',
        lastActivity: user.profile?.lastActivity || now
      }
    });
  } catch (error) {
    console.error('Dashboard Error:', error);
    res.status(500).json({ success: false, message: 'Serverfehler.' });
  }
});

// ─── ALLE USER ───
router.get('/allusers', authMiddleware, (req, res) => {
  try {
    const users = readDB();
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const safeUsers = users.map(u => {
      const lastActivity = u.profile?.lastActivity ? new Date(u.profile.lastActivity) : null;
      const isOnline = lastActivity && lastActivity > fiveMinutesAgo;
      
      return {
        id: u.id,
        username: u.username,
        voltCoins: u.voltCoins,
        createdAt: u.createdAt,
        bio: u.profile?.bio || '',
        avatar: u.profile?.avatar || '',
        isOnline: !!isOnline,
        lastActivity: u.profile?.lastActivity || null
      };
    });
    
    res.json({ success: true, users: safeUsers });
  } catch (error) {
    console.error('Allusers Error:', error);
    res.status(500).json({ success: false, message: 'Serverfehler.' });
  }
});

module.exports = router;