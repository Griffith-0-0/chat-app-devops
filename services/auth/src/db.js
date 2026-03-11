/**
 * Connexion PostgreSQL pour le service Auth
 * Utilise un pool de connexions pour gérer les requêtes BDD.
 * Stocke les utilisateurs (username, email, password_hash).
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// En cas d'erreur critique (connexion perdue), on arrête le processus
pool.on('error', (err) => {
  console.error('PostgreSQL error:', err);
  process.exit(-1);
});

module.exports = pool;