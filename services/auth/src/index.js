/**
 * Point d'entrée du service Auth
 * Démarre le serveur Express sur le port configuré (3001 par défaut).
 * Ce service gère l'authentification : inscription, connexion, déconnexion, refresh token.
 */
require("./instrument.js");

const app = require('./app');

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Auth service running on port ${PORT}`);
});