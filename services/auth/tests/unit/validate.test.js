const { validateRegisterInput, validateLoginInput } = require('../../src/utils/validate');

describe('validate utils', () => {
  describe('validateRegisterInput', () => {
    it('should accept valid input', () => {
      const result = validateRegisterInput('alice', 'alice@test.com', 'password123');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject short username', () => {
      const result = validateRegisterInput('ab', 'a@b.com', 'pass1234');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Username must be at least 3 characters');
    });

    it('should reject invalid email', () => {
      const result = validateRegisterInput('user', 'invalid', 'pass1234');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Valid email is required');
    });

    it('should reject short password', () => {
      const result = validateRegisterInput('user', 'u@b.com', '12345');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 6 characters');
    });

    it('should reject empty values', () => {
      const result = validateRegisterInput('', '', '');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateLoginInput', () => {
    it('should accept valid input', () => {
      const result = validateLoginInput('user@test.com', 'anypass');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid email', () => {
      const result = validateLoginInput('no-at-sign', 'pass');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Valid email is required');
    });

    it('should reject empty password', () => {
      const result = validateLoginInput('u@b.com', '');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password is required');
    });

    it('should reject missing password', () => {
      const result = validateLoginInput('u@b.com', null);
      expect(result.valid).toBe(false);
    });
  });
});
