/**
 * Point d'entrée du service Profiles
 * Démarre le serveur Express sur le port 3002. Gère les profils utilisateur (display_name, avatar, status).
 */
require("./instrument.js");

const app = require('./app');

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Profiles service running on port ${PORT}`);
});