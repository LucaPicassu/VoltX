const express = require('express');
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const USERS_PATH = path.join(__dirname, '../db/users.json');

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

// ─── PROFIL LADEN ───
router.get('/me', authMiddleware, (req, res) => {
  try {
    const users = readUsers();
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: '❌ User nicht gefunden.' });
    }

    const now = new Date().toISOString();
    if (!user.profile) user.profile = {};
    user.profile.lastActivity = now;
    writeUsers(users);

    const isAdmin = (user.username === 'LucaPicassu');

    res.json({
      success: true,
      profile: {
        id: user.id,
        username: user.username,
        email: user.email,
        voltCoins: user.voltCoins,
        bio: user.profile.bio || '',
        avatar: user.profile.avatar || '',
        lastNameChange: user.profile.lastNameChange || null,
        lastDailyBonus: user.profile.lastDailyBonus || null,
        totalBonus: user.profile.totalBonus || 0,
        lastActivity: user.profile.lastActivity || null,
        createdAt: user.createdAt,
        isAdmin: isAdmin
      }
    });
  } catch (error) {
    console.error('Profile Load Error:', error);
    res.status(500).json({ success: false, message: '❌ Serverfehler.' });
  }
});

// ─── BIO ÄNDERN ───
router.post('/bio', authMiddleware, (req, res) => {
  try {
    const { bio } = req.body;
    if (bio === undefined || bio === null) {
      return res.status(400).json({ success: false, message: '❌ Bio darf nicht leer sein.' });
    }
    if (bio.length > 200) {
      return res.status(400).json({ success: false, message: '❌ Bio max. 200 Zeichen.' });
    }

    const users = readUsers();
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: '❌ User nicht gefunden.' });
    }

    if (!user.profile) user.profile = {};
    user.profile.bio = bio || '';
    writeUsers(users);

    res.json({
      success: true,
      message: '✅ Bio aktualisiert!',
      bio: user.profile.bio
    });
  } catch (error) {
    console.error('Bio Error:', error);
    res.status(500).json({ success: false, message: '❌ Serverfehler.' });
  }
});

// ─── AVATAR ÄNDERN ───
router.post('/avatar', authMiddleware, (req, res) => {
  try {
    const { avatar } = req.body;
    if (!avatar || avatar.trim() === '') {
      return res.status(400).json({ success: false, message: '❌ Kein Bild empfangen.' });
    }

    if (!avatar.startsWith('data:image/')) {
      return res.status(400).json({ success: false, message: '❌ Ungültiges Bildformat.' });
    }

    const sizeInBytes = Buffer.byteLength(avatar, 'utf8');
    if (sizeInBytes > 2 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: '❌ Bild max. 2MB.' });
    }

    const users = readUsers();
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: '❌ User nicht gefunden.' });
    }

    if (!user.profile) user.profile = {};
    user.profile.avatar = avatar;
    writeUsers(users);

    res.json({
      success: true,
      message: '✅ Avatar aktualisiert!',
      avatar: user.profile.avatar
    });
  } catch (error) {
    console.error('Avatar Error:', error);
    res.status(500).json({ success: false, message: '❌ Serverfehler.' });
  }
});

// ─── USERNAME ÄNDERN ───
router.post('/username', authMiddleware, (req, res) => {
  try {
    const { newUsername } = req.body;
    if (!newUsername || newUsername.trim() === '') {
      return res.status(400).json({ success: false, message: '❌ Benutzername darf nicht leer sein.' });
    }
    if (newUsername.length < 3) {
      return res.status(400).json({ success: false, message: '❌ Name mind. 3 Zeichen.' });
    }
    if (newUsername.length > 20) {
      return res.status(400).json({ success: false, message: '❌ Name max. 20 Zeichen.' });
    }

    const users = readUsers();
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: '❌ User nicht gefunden.' });
    }

    if (users.find(u => u.username === newUsername && u.id !== req.user.id)) {
      return res.status(409).json({ success: false, message: '❌ Benutzername bereits vergeben.' });
    }

    if (user.profile && user.profile.lastNameChange) {
      const lastChange = new Date(user.profile.lastNameChange);
      const now = new Date();
      const daysSince = (now - lastChange) / (1000 * 60 * 60 * 24);
      
      if (daysSince < 7) {
        const remaining = Math.ceil(7 - daysSince);
        return res.status(400).json({
          success: false,
          message: `❌ Name kann erst in ${remaining} Tag(en) wieder geändert werden.`,
          remainingDays: remaining
        });
      }
    }

    const oldName = user.username;
    user.username = newUsername.trim();
    
    if (!user.profile) user.profile = {};
    user.profile.lastNameChange = new Date().toISOString();
    writeUsers(users);

    res.json({
      success: true,
      message: `✅ Name von "${oldName}" zu "${user.username}" geändert!`,
      newUsername: user.username,
      nextChange: user.profile.lastNameChange
    });
  } catch (error) {
    console.error('Username Error:', error);
    res.status(500).json({ success: false, message: '❌ Serverfehler.' });
  }
});

// ─── DAILY BONUS ───
router.post('/daily-bonus', authMiddleware, (req, res) => {
  try {
    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === req.user.id);
    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: '❌ User nicht gefunden.' });
    }

    const user = users[userIndex];
    const now = new Date();
    
    if (!user.profile) {
      user.profile = { bio: '', avatar: '', lastNameChange: null, lastDailyBonus: null, totalBonus: 0 };
    }

    if (user.profile.lastDailyBonus) {
      const lastBonus = new Date(user.profile.lastDailyBonus);
      const hoursSince = (now - lastBonus) / (1000 * 60 * 60);
      
      if (hoursSince < 24) {
        const remaining = Math.ceil(24 - hoursSince);
        return res.status(400).json({
          success: false,
          message: `⏳ Du kannst den Bonus erst in ${remaining} Stunden wieder abholen.`,
          remainingHours: remaining,
          canClaim: false
        });
      }
    }

    const bonusAmount = Math.floor(Math.random() * 41) + 10;
    
    users[userIndex].voltCoins = (users[userIndex].voltCoins || 0) + bonusAmount;
    users[userIndex].profile.lastDailyBonus = now.toISOString();
    users[userIndex].profile.totalBonus = (users[userIndex].profile.totalBonus || 0) + bonusAmount;
    
    writeUsers(users);

    res.json({
      success: true,
      message: `🎉 Du hast ${bonusAmount} Coins als täglichen Bonus erhalten!`,
      bonusAmount: bonusAmount,
      newCoins: users[userIndex].voltCoins,
      totalBonus: users[userIndex].profile.totalBonus,
      canClaim: false,
      nextClaim: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
    });
  } catch (error) {
    console.error('Daily Bonus Error:', error);
    res.status(500).json({ success: false, message: '❌ Serverfehler.' });
  }
});

// ─── DAILY BONUS STATUS ───
router.get('/daily-bonus-status', authMiddleware, (req, res) => {
  try {
    const users = readUsers();
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: '❌ User nicht gefunden.' });
    }

    let canClaim = true;
    let remainingHours = 0;
    let lastBonus = null;

    if (user.profile?.lastDailyBonus) {
      const last = new Date(user.profile.lastDailyBonus);
      const now = new Date();
      const hoursSince = (now - last) / (1000 * 60 * 60);
      
      if (hoursSince < 24) {
        canClaim = false;
        remainingHours = Math.ceil(24 - hoursSince);
        lastBonus = user.profile.lastDailyBonus;
      }
    }

    res.json({
      success: true,
      canClaim: canClaim,
      remainingHours: remainingHours,
      lastBonus: lastBonus,
      totalBonus: user.profile?.totalBonus || 0
    });
  } catch (error) {
    console.error('Daily Bonus Status Error:', error);
    res.status(500).json({ success: false, message: '❌ Serverfehler.' });
  }
});

// ─── COIN TRANSFER ───
router.post('/transfer', authMiddleware, (req, res) => {
  try {
    const { targetUsername, amount, message } = req.body;
    
    if (!targetUsername || targetUsername.trim() === '') {
      return res.status(400).json({ success: false, message: '❌ Bitte einen Empfänger angeben.' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: '❌ Bitte einen gültigen Betrag eingeben.' });
    }
    if (amount > 1000000) {
      return res.status(400).json({ success: false, message: '❌ Max. 1.000.000 Coins pro Transfer.' });
    }

    const users = readUsers();
    
    const senderIndex = users.findIndex(u => u.id === req.user.id);
    if (senderIndex === -1) {
      return res.status(404).json({ success: false, message: '❌ Sender nicht gefunden.' });
    }
    const sender = users[senderIndex];

    const receiverIndex = users.findIndex(u => u.username === targetUsername.trim());
    if (receiverIndex === -1) {
      return res.status(404).json({ success: false, message: '❌ Empfänger nicht gefunden.' });
    }
    const receiver = users[receiverIndex];

    if (sender.id === receiver.id) {
      return res.status(400).json({ success: false, message: '❌ Du kannst dir nicht selbst Coins schicken.' });
    }
    if (sender.voltCoins < amount) {
      return res.status(400).json({ success: false, message: `❌ Nicht genügend Coins. Du hast ${sender.voltCoins}.` });
    }

    users[senderIndex].voltCoins -= amount;
    users[receiverIndex].voltCoins += amount;

    const transaction = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
      from: sender.username,
      to: receiver.username,
      amount: amount,
      message: message || 'Keine Nachricht',
      timestamp: new Date().toISOString()
    };

    if (!users[senderIndex].transactions) users[senderIndex].transactions = [];
    users[senderIndex].transactions.unshift(transaction);

    if (!users[receiverIndex].transactions) users[receiverIndex].transactions = [];
    users[receiverIndex].transactions.unshift(transaction);

    writeUsers(users);

    res.json({
      success: true,
      message: `✅ ${amount} Coins an ${receiver.username} gesendet!`,
      newCoins: users[senderIndex].voltCoins,
      transaction: transaction
    });
  } catch (error) {
    console.error('Transfer Error:', error);
    res.status(500).json({ success: false, message: '❌ Serverfehler.' });
  }
});

// ─── TRANSACTION HISTORY ───
router.get('/transactions', authMiddleware, (req, res) => {
  try {
    const users = readUsers();
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: '❌ User nicht gefunden.' });
    }

    const transactions = user.transactions || [];
    const limit = parseInt(req.query.limit) || 20;

    res.json({
      success: true,
      transactions: transactions.slice(0, limit),
      total: transactions.length
    });
  } catch (error) {
    console.error('Transactions Error:', error);
    res.status(500).json({ success: false, message: '❌ Serverfehler.' });
  }
});

module.exports = router;