/**
 * Utilitaires de hachage des mots de passe
 * Utilise bcrypt pour hasher et comparer les mots de passe (sécurité).
 */
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10; // Plus élevé = plus sécurisé mais plus lent

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = {
  hashPassword,
  comparePassword,
};
