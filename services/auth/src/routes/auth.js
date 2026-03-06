const express = require('express');
const pool = require('../db');
const redis = require('../redis');
const { hashPassword, comparePassword } = require('../utils/hash');
const { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } = require('../utils/jwt');
const { validateRegisterInput, validateLoginInput } = require('../utils/validate');
require('dotenv').config();

const router = express.Router();

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
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const validation = validateLoginInput(email, password);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.errors[0] });
  }
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    res.json({ accessToken, refreshToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(400).json({ error: 'No token provided' });

  await redis.set(`blacklist:${token}`, '1', { EX: 15 * 60 });
  res.json({ message: 'Logged out' });
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'No refresh token' });

  try {
    const payload = verifyRefreshToken(refreshToken);
    const accessToken = generateAccessToken(payload.userId);
    res.json({ accessToken });
  } catch (_err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

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