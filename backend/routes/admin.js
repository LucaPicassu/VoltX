const express = require('express');
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const USERS_PATH = path.join(__dirname, '../db/users.json');
const SHOP_PATH = path.join(__dirname, '../db/shop.json');

// ─── ADMIN HART GECODET ───
const ADMIN_USERNAME = 'LucaPicassu';

function readUsers() {
  try {
    const data = fs.readFileSync(USERS_PATH, 'utf-8');
    if (!data || data.trim() === '') return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeUsers(data) {
  fs.writeFileSync(USERS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function readShop() {
  try {
    const data = fs.readFileSync(SHOP_PATH, 'utf-8');
    if (!data || data.trim() === '') return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeShop(data) {
  fs.writeFileSync(SHOP_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── ADMIN AUTH MIDDLEWARE ───
const adminAuthMiddleware = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ success: false, message: '❌ Kein Token.' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    if (decoded.username !== ADMIN_USERNAME) {
      return res.status(403).json({ success: false, message: '❌ Keine Admin-Rechte.' });
    }
    next();
  } catch {
    return res.status(403).json({ success: false, message: '❌ Ungültiger Token.' });
  }
};

// ─── ADMIN DASHBOARD STATS ───
router.get('/dashboard', adminAuthMiddleware, (req, res) => {
  try {
    const users = readUsers();
    const shop = readShop();
    const totalCoins = users.reduce((sum, u) => sum + (u.voltCoins || 0), 0);
    
    res.json({
      success: true,
      stats: {
        totalUsers: users.length,
        totalItems: shop.length,
        totalCoins: totalCoins,
        totalAdmins: 1,
        totalPurchases: shop.reduce((sum, item) => sum + (item.boughtBy?.length || 0), 0)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '❌ Serverfehler.' });
  }
});

// ─── ALLE USER ───
router.get('/users', adminAuthMiddleware, (req, res) => {
  try {
    const users = readUsers();
    const safeUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      voltCoins: u.voltCoins,
      createdAt: u.createdAt,
      bio: u.profile?.bio || '',
      avatar: u.profile?.avatar || ''
    }));
    res.json({ success: true, users: safeUsers });
  } catch (error) {
    res.status(500).json({ success: false, message: '❌ Serverfehler.' });
  }
});

// ─── USER COINS ÄNDERN ───
router.post('/user/coins', adminAuthMiddleware, (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || typeof amount !== 'number') {
      return res.status(400).json({ success: false, message: '❌ User-ID und Betrag benötigt.' });
    }

    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: '❌ User nicht gefunden.' });
    }

    users[userIndex].voltCoins = (users[userIndex].voltCoins || 0) + amount;
    if (users[userIndex].voltCoins < 0) users[userIndex].voltCoins = 0;
    writeUsers(users);

    res.json({
      success: true,
      message: `✅ ${users[userIndex].username} hat jetzt ${users[userIndex].voltCoins} Coins.`,
      newCoins: users[userIndex].voltCoins
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '❌ Serverfehler.' });
  }
});

// ─── USER LÖSCHEN ───
router.delete('/user/:userId', adminAuthMiddleware, (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: '❌ User-ID benötigt.' });
    }

    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: '❌ User nicht gefunden.' });
    }

    const deletedUser = users[userIndex];
    users.splice(userIndex, 1);
    writeUsers(users);

    res.json({
      success: true,
      message: `✅ User ${deletedUser.username} wurde gelöscht.`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '❌ Serverfehler.' });
  }
});

// ─── SHOP ITEMS ───
router.get('/items', adminAuthMiddleware, (req, res) => {
  try {
    const items = readShop();
    res.json({ success: true, items });
  } catch (error) {
    res.status(500).json({ success: false, message: '❌ Serverfehler.' });
  }
});

// ─── SHOP ITEM LÖSCHEN ───
router.delete('/item/:itemId', adminAuthMiddleware, (req, res) => {
  try {
    const { itemId } = req.params;
    if (!itemId) {
      return res.status(400).json({ success: false, message: '❌ Item-ID benötigt.' });
    }

    const items = readShop();
    const itemIndex = items.findIndex(i => i.id === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: '❌ Item nicht gefunden.' });
    }

    const deletedItem = items[itemIndex];
    items.splice(itemIndex, 1);
    writeShop(items);

    res.json({
      success: true,
      message: `✅ Item "${deletedItem.name}" wurde gelöscht.`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '❌ Serverfehler.' });
  }
});

module.exports = router;