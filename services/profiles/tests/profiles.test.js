const request = require('supertest');
const axios = require('axios');
const app = require('../src/app');

jest.mock('axios');

describe('Profiles Service', () => {
  const mockUserId = 'ca453145-bc8c-48c6-891e-e4c5ef7da610';

  beforeEach(() => {
    axios.get.mockResolvedValue({ data: { userId: mockUserId } });
  });

  describe('GET /profiles', () => {
    it('should return list of profiles', async () => {
      const res = await request(app).get('/profiles');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return profiles with expected shape', async () => {
      const res = await request(app).get('/profiles');
      expect(res.status).toBe(200);
      res.body.forEach((profile) => {
        expect(profile).toHaveProperty('user_id');
        expect(profile).toHaveProperty('display_name');
        expect(profile).toHaveProperty('avatar_url');
        expect(profile).toHaveProperty('status');
      });
    });
  });

  describe('GET /profiles/:userId', () => {
    it('should return 404 for non-existent profile', async () => {
      const res = await request(app).get('/profiles/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Profile not found');
    });

    it('should return profile after creating it via PUT', async () => {
      await request(app)
        .put(`/profiles/${mockUserId}`)
        .set('Authorization', 'Bearer fake-token')
        .send({ display_name: 'Integration Test User', avatar_url: null, status: 'online' });

      const res = await request(app).get(`/profiles/${mockUserId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user_id', mockUserId);
      expect(res.body).toHaveProperty('display_name', 'Integration Test User');
      expect(res.body).toHaveProperty('status', 'online');
    });
  });

  describe('PUT /profiles/:userId', () => {
    it('should create or update profile', async () => {
      const res = await request(app)
        .put(`/profiles/${mockUserId}`)
        .set('Authorization', 'Bearer fake-token')
        .send({ display_name: 'Test User', avatar_url: 'https://example.com/avatar.png', status: 'online' });
      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('display_name', 'Test User');
      expect(res.body).toHaveProperty('user_id', mockUserId);
    });

    it('should return 403 when modifying another user profile', async () => {
      const res = await request(app)
        .put('/profiles/other-user-id')
        .set('Authorization', 'Bearer fake-token')
        .send({ display_name: 'Hacker', status: 'online' });
      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error', 'Forbidden');
    });

    it('should return 401 when no token provided', async () => {
      const res = await request(app)
        .put(`/profiles/${mockUserId}`)
        .send({ display_name: 'Test', status: 'online' });
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'No token provided');
    });

    it('should return 401 when auth service rejects token', async () => {
      axios.get.mockRejectedValueOnce(new Error('Invalid token'));
      const res = await request(app)
        .put(`/profiles/${mockUserId}`)
        .set('Authorization', 'Bearer invalid-token')
        .send({ display_name: 'Test', status: 'online' });
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Unauthorized');
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
