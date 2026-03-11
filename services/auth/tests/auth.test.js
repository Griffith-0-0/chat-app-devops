/**
 * Tests d'intégration du service Auth
 * Vérifie register, login, health check. Utilise Supertest pour simuler les requêtes HTTP.
 */
const request = require('supertest');
const app = require('../src/app');

describe('Auth Service', () => {
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