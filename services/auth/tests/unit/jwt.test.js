/**
 * Tests unitaires des utilitaires JWT
 * Vérifie génération et vérification des access/refresh tokens.
 */
const {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} = require('../../src/utils/jwt');

describe('jwt utils', () => {
  const originalEnv = process.env;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('generateAccessToken', () => {
    it('should generate a non-empty token', () => {
      const token = generateAccessToken(42);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a non-empty token', () => {
      const token = generateRefreshToken(99);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('verifyAccessToken', () => {
    it('should decode payload with userId', () => {
      const userId = 123;
      const token = generateAccessToken(userId);
      const payload = verifyAccessToken(token);
      expect(payload.userId).toBe(userId);
      expect(payload).toHaveProperty('iat');
      expect(payload).toHaveProperty('exp');
    });

    it('should throw for invalid token', () => {
      expect(() => verifyAccessToken('invalid.token.here')).toThrow();
    });

    it('should throw for token signed with wrong secret', () => {
      const token = generateRefreshToken(1); // uses JWT_REFRESH_SECRET
      expect(() => verifyAccessToken(token)).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should decode payload with userId', () => {
      const userId = 456;
      const token = generateRefreshToken(userId);
      const payload = verifyRefreshToken(token);
      expect(payload.userId).toBe(userId);
    });

    it('should throw for invalid token', () => {
      expect(() => verifyRefreshToken('invalid')).toThrow();
    });
  });
});
