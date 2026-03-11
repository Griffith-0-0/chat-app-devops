/**
 * Métriques Prometheus pour le service Profiles
 * Exposées sur /metrics pour le scraping par Prometheus
 */
const promClient = require('prom-client');

// Métriques système par défaut (CPU, mémoire, event loop...)
promClient.collectDefaultMetrics({ prefix: 'profiles_' });

// Requêtes GET (liste + profil individuel)
const requestsTotal = new promClient.Counter({
  name: 'profiles_requests_total',
  help: 'Total number of profile requests (GET)',
  labelNames: ['type']
});

// Mises à jour de profil (PUT)
const updatesTotal = new promClient.Counter({
  name: 'profiles_updates_total',
  help: 'Total number of successful profile updates (PUT)'
});

async function getMetrics() {
  return promClient.register.metrics();
}

function getContentType() {
  return promClient.register.contentType;
}

module.exports = {
  requestsTotal,
  updatesTotal,
  getMetrics,
  getContentType
};
