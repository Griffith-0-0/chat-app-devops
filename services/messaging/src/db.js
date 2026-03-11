/**
 * Connexion PostgreSQL pour le service Messaging
 * Stocke les messages : room_id, sender_id, content, created_at.
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('PostgreSQL error:', err);
  process.exit(-1);
});

module.exports = pool;