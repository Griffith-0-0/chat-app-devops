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

// Inscriptions échouées (validation BDD, contrainte unique, etc.)
const failedRegistersTotal = new promClient.Counter({
  name: 'auth_failed_registers_total',
  help: 'Total number of failed registration attempts'
});

// Déconnexions
const logoutsTotal = new promClient.Counter({
  name: 'auth_logouts_total',
  help: 'Total number of logouts'
});

// Refresh tokens émis
const refreshTokensTotal = new promClient.Counter({
  name: 'auth_refresh_tokens_total',
  help: 'Total number of refresh token exchanges'
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
  failedRegistersTotal,
  logoutsTotal,
  refreshTokensTotal,
  getMetrics,
  getContentType
};