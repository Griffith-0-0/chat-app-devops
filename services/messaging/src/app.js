/**
 * Configuration Express du service Messaging (partie HTTP)
 * Routes REST pour l'historique des messages (GET /messages/:roomId). Socket.io gère le temps réel dans index.js.
 */
const express = require('express');
const cors = require('cors');
const Sentry = require("@sentry/node");
const messageRoutes = require('./routes/messages');
const metrics = require('./metrics');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Métriques Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', metrics.getContentType());
  res.end(await metrics.getMetrics());
});

app.use('/messages', messageRoutes);

Sentry.setupExpressErrorHandler(app);

module.exports = app;
