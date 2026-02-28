const express = require('express');
const profileRoutes = require('./routes/profiles');
require('dotenv').config();

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/profiles', profileRoutes);

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Profiles service running on port ${PORT}`);
});