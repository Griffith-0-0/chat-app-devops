/**
 * Routes d'authentification du service Auth
 * Endpoints : register, login, logout, refresh, verify.
 * Utilise PostgreSQL pour les users, Redis pour la blacklist des tokens.
 */
const express = require('express');
const pool = require('../db');
const redis = require('../redis');
const metrics = require('../metrics');
const { hashPassword, comparePassword } = require('../utils/hash');
const { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } = require('../utils/jwt');
const { validateRegisterInput, validateLoginInput } = require('../utils/validate');
require('dotenv').config();

const router = express.Router();

// Inscription : validation, hash du mot de passe, insertion en BDD
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  const validation = validateRegisterInput(username, email, password);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.errors[0] });
  }
  try {
    const hash = await hashPassword(password);
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, hash]
    );
    // Métriques Prometheus
    metrics.registersTotal.inc();
    res.status(201).json(result.rows[0]);
  } catch (err) {
    // Métriques Prometheus
    metrics.failedRegistersTotal.inc();
    res.status(400).json({ error: err.message });
  }
});

// Connexion : vérification creds, génération access + refresh tokens
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const validation = validateLoginInput(email, password);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.errors[0] });
  }
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) {
      // Métriques Prometheus
      metrics.failedLoginsTotal.inc();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      // Métriques Prometheus
      metrics.failedLoginsTotal.inc();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Métriques Prometheus
    metrics.loginsTotal.inc();
    res.json({ accessToken, refreshToken });
  } catch (err) {
    // Métriques Prometheus
    metrics.failedLoginsTotal.inc();
    res.status(500).json({ error: err.message });
  }
});

// Déconnexion : ajoute le token à la blacklist Redis (TTL = durée de vie du token)
router.post('/logout', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(400).json({ error: 'No token provided' });

  await redis.set(`blacklist:${token}`, '1', { EX: 15 * 60 });
  // Métriques Prometheus
  metrics.logoutsTotal.inc();
  res.json({ message: 'Logged out' });
});

// Rafraîchissement : échange refresh token contre nouveau access token
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'No refresh token' });

  try {
    const payload = verifyRefreshToken(refreshToken);
    const accessToken = generateAccessToken(payload.userId);
    // Métriques Prometheus
    metrics.refreshTokensTotal.inc();
    res.json({ accessToken });
  } catch (_err) {
    // Métriques Prometheus
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Vérification : valide le token et vérifie qu'il n'est pas blacklisté (utilisé par les autres services)
router.get('/verify', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const isBlacklisted = await redis.get(`blacklist:${token}`);
  if (isBlacklisted) return res.status(401).json({ error: 'Token revoked' });

  try {
    const payload = verifyAccessToken(token);
    res.json({ userId: payload.userId });
  } catch (_err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;