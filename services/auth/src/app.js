/**
 * Configuration principale de l'application Express du service Auth
 * Configure CORS, JSON, les routes d'authentification et le endpoint de santé (health check).
 */
const express = require('express');
const cors = require('cors');
const Sentry = require("@sentry/node");
const authRoutes = require('./routes/auth');
const metrics = require('./metrics');
require('dotenv').config();

const app = express();
// CORS : autorise les requêtes cross-origin (front, autres services)
app.use(cors());
// Parse le corps des requêtes en JSON
app.use(express.json());

// Health check : utilisé par K8s (readiness/liveness probes) et load balancers
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Métriques Prometheus 
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', metrics.getContentType());
    res.end(await metrics.getMetrics());
  });

// Toutes les routes d'auth sont préfixées par /auth
app.use('/auth', authRoutes);

// Route de test Sentry (à retirer en production)
app.get('/debug-sentry', function mainHandler(_req, _res) {
  throw new Error('My first Sentry error!');
});

// Error handler Sentry — après toutes les routes, avant tout autre middleware d'erreur
Sentry.setupExpressErrorHandler(app);

module.exports = app;