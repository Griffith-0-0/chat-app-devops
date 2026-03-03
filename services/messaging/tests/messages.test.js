const request = require('supertest');
const axios = require('axios');
const app = require('../src/app');

jest.mock('axios');

describe('Messaging Service', () => {
  const mockUserId = 'ca453145-bc8c-48c6-891e-e4c5ef7da610';

  beforeEach(() => {
    axios.get.mockResolvedValue({ data: { userId: mockUserId } });
  });

  describe('GET /messages/:roomId', () => {
    it('should return messages array for a room', async () => {
      const res = await request(app)
        .get('/messages/room-general')
        .set('Authorization', 'Bearer fake-token');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return messages with expected shape when room has messages', async () => {
      const res = await request(app)
        .get('/messages/any-room-id')
        .set('Authorization', 'Bearer fake-token');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach((msg) => {
        expect(msg).toHaveProperty('id');
        expect(msg).toHaveProperty('room_id');
        expect(msg).toHaveProperty('sender_id');
        expect(msg).toHaveProperty('content');
        expect(msg).toHaveProperty('created_at');
      });
    });

    it('should return 401 without token', async () => {
      const res = await request(app).get('/messages/room-general');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'No token provided');
    });

    it('should return 401 when auth service rejects token', async () => {
      axios.get.mockRejectedValueOnce(new Error('Invalid token'));
      const res = await request(app)
        .get('/messages/room-general')
        .set('Authorization', 'Bearer invalid-token');
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
