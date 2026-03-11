/**
 * Routes CRUD du service Profiles
 * GET / : liste tous les profils. GET /:userId : un profil. PUT /:userId : créer/mettre à jour (protégé, ownership vérifié).
 */
const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const metrics = require('../metrics');

const router = express.Router();

// Liste tous les profils (public)
router.get('/', async (req, res) => {
  metrics.requestsTotal.inc({ type: 'list' });
  try {
    const result = await pool.query('SELECT user_id, display_name, avatar_url, status FROM profiles');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Profil par userId (public)
router.get('/:userId', async (req, res) => {
  metrics.requestsTotal.inc({ type: 'get' });
  try {
    const result = await pool.query(
      'SELECT user_id, display_name, avatar_url, status FROM profiles WHERE user_id = $1',
      [req.params.userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Profile not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Créer ou mettre à jour son propre profil (auth requise, vérification userId)
router.put('/:userId', authMiddleware, async (req, res) => {
  const { display_name, avatar_url, status } = req.body;
  if (req.userId !== req.params.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO profiles (user_id, display_name, avatar_url, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
       SET display_name = $2, avatar_url = $3, status = $4, updated_at = NOW()
       RETURNING *`,
      [req.params.userId, display_name, avatar_url, status]
    );
    metrics.updatesTotal.inc();
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;