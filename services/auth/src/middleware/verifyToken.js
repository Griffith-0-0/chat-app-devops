/**
 * Middleware de vérification du token JWT
 * Vérifie la présence du token, qu'il n'est pas blacklisté (logout), puis décode le payload.
 * Injecte req.userId pour les routes protégées. Utilisé par profiles et messaging.
 */
const jwt = require('jsonwebtoken');
const redis = require('../redis');
require('dotenv').config();

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const isBlacklisted = await redis.get(`blacklist:${token}`);
  if (isBlacklisted) return res.status(401).json({ error: 'Token revoked' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (_err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = verifyToken;

/** test */