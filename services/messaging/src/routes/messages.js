/**
 * Routes REST du service Messaging
 * GET /messages/:roomId : historique des messages d'une room (protégé par auth).
 */
const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Historique des messages d'une room (auth requise)
router.get('/:roomId', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM messages WHERE room_id = $1 ORDER BY created_at ASC',
      [req.params.roomId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;