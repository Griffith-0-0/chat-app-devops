/**
 * Connexion PostgreSQL pour le service Profiles
 * Stocke les profils : user_id, display_name, avatar_url, status.
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