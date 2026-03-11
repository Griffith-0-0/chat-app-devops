/**
 * Client Redis pour le service Messaging
 * Disponible pour cache, rate limiting ou rooms actives (actuellement utilisé par RabbitMQ côté events).
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