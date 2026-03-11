/**
 * Métriques Prometheus pour le service Messaging
 * Exposées sur /metrics pour le scraping par Prometheus
 */
const promClient = require('prom-client');

// Métriques système par défaut (CPU, mémoire, event loop...)
promClient.collectDefaultMetrics({ prefix: 'messaging_' });

// Messages envoyés (Socket.io send_message)
const messagesTotal = new promClient.Counter({
  name: 'chat_messages_total',
  help: 'Total number of messages sent',
  labelNames: ['room_id']
});

// Connexions WebSocket actives
const activeConnections = new promClient.Gauge({
  name: 'chat_active_connections',
  help: 'Number of active WebSocket connections'
});

async function getMetrics() {
  return promClient.register.metrics();
}

function getContentType() {
  return promClient.register.contentType;
}

module.exports = {
  messagesTotal,
  activeConnections,
  getMetrics,
  getContentType
};
