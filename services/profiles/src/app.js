const express = require('express');
const profileRoutes = require('./routes/profiles');
require('dotenv').config();

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/profiles', profileRoutes);

module.exports = app;
