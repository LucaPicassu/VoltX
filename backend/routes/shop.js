const express = require('express');
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const SHOP_PATH = path.join(__dirname, '../db/shop.json');
const USERS_PATH = path.join(__dirname, '../db/users.json');

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

// ─── ALLE ITEMS ───
router.get('/items', authMiddleware, (req, res) => {
  try {
    const items = readShop();
    res.json({ success: true, items });
  } catch (error) {
    res.status(500).json({ success: false, message: '❌ Serverfehler.' });
  }
});

// ─── ITEMS SUCHEN ───
router.get('/search', authMiddleware, (req, res) => {
  try {
    const { q, minPrice, maxPrice, sort } = req.query;
    let items = readShop();

    if (q && q.trim() !== '') {
      const searchTerm = q.trim().toLowerCase();
      items = items.filter(item => 
        item.name.toLowerCase().includes(searchTerm) ||
        item.description.toLowerCase().includes(searchTerm)
      );
    }

    if (minPrice && !isNaN(minPrice)) {
      items = items.filter(item => item.price >= Number(minPrice));
    }
    if (maxPrice && !isNaN(maxPrice)) {
      items = items.filter(item => item.price <= Number(maxPrice));
    }

    if (sort === 'price_asc') {
      items.sort((a, b) => a.price - b.price);
    } else if (sort === 'price_desc') {
      items.sort((a, b) => b.price - a.price);
    } else if (sort === 'name_asc') {
      items.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'name_desc') {
      items.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sort === 'popular') {
      items.sort((a, b) => (b.boughtBy?.length || 0) - (a.boughtBy?.length || 0));
    } else {
      items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    res.json({
      success: true,
      items: items,
      totalResults: items.length,
      searchParams: { q: q || '', minPrice: minPrice || '', maxPrice: maxPrice || '', sort: sort || 'newest' }
    });
  } catch (error) {
    console.error('Search Error:', error);
    res.status(500).json({ success: false, message: '❌ Serverfehler.' });
  }
});

// ─── UPLOAD ───
router.post('/upload', authMiddleware, (req, res) => {
  try {
    const { name, price, downloadLink, virusTotalLink, description } = req.body;
    const users = readUsers();
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: '❌ User nicht gefunden.' });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: '❌ Name ist Pflicht.' });
    }
    if (!price || isNaN(price) || price <= 0) {
      return res.status(400).json({ success: false, message: '❌ Preis muss positiv sein.' });
    }
    if (!downloadLink || downloadLink.trim() === '') {
      return res.status(400).json({ success: false, message: '❌ Download-Link ist Pflicht.' });
    }
    if (!virusTotalLink || virusTotalLink.trim() === '') {
      return res.status(400).json({ success: false, message: '❌ VirusTotal-Link ist Pflicht.' });
    }
    if (!description || description.trim() === '') {
      return res.status(400).json({ success: false, message: '❌ Beschreibung ist Pflicht.' });
    }
    if (name.trim().length < 3) {
      return res.status(400).json({ success: false, message: '❌ Name mind. 3 Zeichen.' });
    }
    if (description.trim().length < 10) {
      return res.status(400).json({ success: false, message: '❌ Beschreibung mind. 10 Zeichen.' });
    }

    const items = readShop();
    const newItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
      name: name.trim(),
      price: Number(price),
      downloadLink: downloadLink.trim(),
      virusTotalLink: virusTotalLink.trim(),
      description: description.trim(),
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
      boughtBy: [],
      downloadCount: 0
    };
    items.push(newItem);
    writeShop(items);
    res.json({ success: true, message: '✅ Item hochgeladen!', item: newItem });
  } catch (error) {
    res.status(500).json({ success: false, message: '❌ Serverfehler: ' + error.message });
  }
});

// ─── KAUFEN ───
router.post('/buy', authMiddleware, (req, res) => {
  try {
    const { itemId } = req.body;
    if (!itemId) {
      return res.status(400).json({ success: false, message: '❌ Item-ID fehlt.' });
    }

    let users = readUsers();
    const buyerIndex = users.findIndex(u => u.id === req.user.id);
    if (buyerIndex === -1) {
      return res.status(404).json({ success: false, message: '❌ Käufer nicht gefunden.' });
    }

    const shopItems = readShop();
    const itemIndex = shopItems.findIndex(i => i.id === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: '❌ Item nicht gefunden.' });
    }

    const item = shopItems[itemIndex];
    const buyer = users[buyerIndex];

    if (buyer.voltCoins < item.price) {
      return res.status(400).json({ success: false, message: '❌ Nicht genügend Volt Coins.' });
    }

    if (item.createdBy === req.user.id) {
      return res.status(400).json({ success: false, message: '❌ Du kannst dein eigenes Item nicht kaufen.' });
    }

    users[buyerIndex].voltCoins -= item.price;
    const sellerIndex = users.findIndex(u => u.id === item.createdBy);
    if (sellerIndex !== -1) {
      users[sellerIndex].voltCoins += item.price;
    }
    writeUsers(users);

    if (!item.boughtBy) item.boughtBy = [];
    if (!item.boughtBy.includes(req.user.id)) {
      item.boughtBy.push(req.user.id);
    }
    item.downloadCount = (item.downloadCount || 0) + 1;
    shopItems[itemIndex] = item;
    writeShop(shopItems);

    res.json({
      success: true,
      message: `✅ ${item.name} gekauft!`,
      remainingCoins: users[buyerIndex].voltCoins,
      downloadLink: item.downloadLink,
      downloadCount: item.downloadCount
    });
  } catch (error) {
    console.error('Buy Error:', error);
    res.status(500).json({ success: false, message: '❌ Serverfehler beim Kauf.' });
  }
});

module.exports = router;