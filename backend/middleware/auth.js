const jwt = require('jsonwebtoken');
const JWT_SECRET = 'voltX_super_secret_2026';

const authMiddleware = (req, res, next) => {
  const token = req.cookies.token;
  
  if (!token) {
    return res.status(401).json({ success: false, message: '❌ Kein Token.' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: '❌ Ungültiger Token.' });
  }
};

module.exports = authMiddleware;