/**
 * Configuration Express du service Profiles
 * Routes : GET/PUT profils, health check. Le PUT est protégé par authMiddleware (vérification via le service Auth).
 */
const express = require('express');
const Sentry = require("@sentry/node");
const profileRoutes = require('./routes/profiles');
const metrics = require('./metrics');
require('dotenv').config();

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Métriques Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', metrics.getContentType());
  res.end(await metrics.getMetrics());
});

app.use('/profiles', profileRoutes);

Sentry.setupExpressErrorHandler(app);

module.exports = app;
