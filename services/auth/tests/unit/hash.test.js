/**
 * Tests unitaires des utilitaires hash (bcrypt)
 * Vérifie hashPassword et comparePassword.
 */
const { hashPassword, comparePassword } = require('../../src/utils/hash');

describe('hash utils', () => {
  describe('hashPassword', () => {
    it('should return a hash different from the plain password', async () => {
      const password = 'secret123';
      const hash = await hashPassword(password);
      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$2[aby]\$\d+\$.+$/); // bcrypt format
    });

    it('should produce different hashes for same password (salt)', async () => {
      const password = 'samepass';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    it('should return true when password matches hash', async () => {
      const password = 'mypassword';
      const hash = await hashPassword(password);
      const valid = await comparePassword(password, hash);
      expect(valid).toBe(true);
    });

    it('should return false when password does not match hash', async () => {
      const password = 'correct';
      const wrongPassword = 'wrong';
      const hash = await hashPassword(password);
      const valid = await comparePassword(wrongPassword, hash);
      expect(valid).toBe(false);
    });
  });
});
