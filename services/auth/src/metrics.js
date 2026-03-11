/**
 * Métriques Prometheus pour le service Auth
 * Exposées sur /metrics pour le scraping par Prometheus
 */
const promClient = require('prom-client');

// Métriques système par défaut (CPU, mémoire, event loop...)
promClient.collectDefaultMetrics({ prefix: 'auth_' });

// Logins réussis
const loginsTotal = new promClient.Counter({
  name: 'auth_logins_total',
  help: 'Total number of successful logins'
});

// Logins échoués (invalid credentials)
const failedLoginsTotal = new promClient.Counter({
  name: 'auth_failed_logins_total',
  help: 'Total number of failed login attempts'
});

// Inscriptions réussies
const registersTotal = new promClient.Counter({
  name: 'auth_registers_total',
  help: 'Total number of successful registrations'
});

async function getMetrics() {
  return promClient.register.metrics();
}

function getContentType() {
  return promClient.register.contentType;
}

module.exports = {
  loginsTotal,
  failedLoginsTotal,
  registersTotal,
  getMetrics,
  getContentType
};