/**
 * Client Redis pour le service Auth
 * Utilisé pour la blacklist des tokens (logout) : les tokens révoqués sont stockés
 * avec une TTL pour éviter leur réutilisation avant expiration.
 */
const { createClient } = require('redis');
require('dotenv').config();

const client = createClient({
  url: process.env.REDIS_URL,
});

client.on('error', (err) => {
  console.error('Redis error:', err);
});

client.connect();

module.exports = client;