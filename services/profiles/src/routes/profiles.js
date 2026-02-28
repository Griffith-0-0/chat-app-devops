const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT user_id, display_name, avatar_url, status FROM profiles');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:userId', async (req, res) => {
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
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;