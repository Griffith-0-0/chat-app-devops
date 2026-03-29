/**
 * Tests d'intégration du service Auth
 * Vérifie register, login, health check. Supertest + app Express.
 * DB et Redis sont mockés pour CI/Jenkins sans Postgres/Redis réels.
 */
jest.mock('../src/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  connect: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
}));

jest.mock('../src/db', () => ({
  query: jest.fn(),
  on: jest.fn(),
}));

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_jest_must_be_long_enough!!';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_for_jest_must_be_long!!';

const request = require('supertest');
const db = require('../src/db');
const app = require('../src/app');

/** Stockage en mémoire pour simuler users (email → ligne complète avec password_hash) */
const usersByEmail = new Map();

function dbQueryImpl(sql, params) {
  if (sql.includes('INSERT INTO users')) {
    const [username, email, passwordHash] = params;
    if (usersByEmail.has(email)) {
      const err = new Error('duplicate key value violates unique constraint');
      err.code = '23505';
      return Promise.reject(err);
    }
    const id = String(usersByEmail.size + 1);
    const row = { id, username, email };
    usersByEmail.set(email, { id, username, email, password_hash: passwordHash });
    return Promise.resolve({ rows: [row] });
  }
  if (sql.includes('SELECT * FROM users')) {
    const email = params[0];
    const u = usersByEmail.get(email);
    return Promise.resolve({ rows: u ? [u] : [] });
  }
  return Promise.resolve({ rows: [] });
}

describe('Auth Service', () => {
  beforeEach(() => {
    usersByEmail.clear();
    db.query.mockImplementation(dbQueryImpl);
  });

  describe('POST /auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          username: `testuser_${Date.now()}`,
          email: `test_${Date.now()}@test.com`,
          password: 'password123',
        });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('email');
      expect(res.body).not.toHaveProperty('password_hash');
    });

    it('should fail with duplicate email', async () => {
      const email = `dup_${Date.now()}@test.com`;
      await request(app)
        .post('/auth/register')
        .send({ username: `user1_${Date.now()}`, email, password: 'pass123' });

      const res = await request(app)
        .post('/auth/register')
        .send({ username: `user2_${Date.now()}`, email, password: 'pass123' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const email = `login_${Date.now()}@test.com`;
      await request(app)
        .post('/auth/register')
        .send({ username: `loginuser_${Date.now()}`, email, password: 'password123' });

      const res = await request(app)
        .post('/auth/login')
        .send({ email, password: 'password123' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('should fail with wrong password', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'test@test.com', password: 'wrongpassword' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /health', () => {
    it('should return ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
