/**
 * Tests d'intégration du service Messaging
 * Vérifie GET /messages/:roomId, auth, 401. Mock axios (Auth) + mock pg (pas de Postgres en CI).
 */
jest.mock('../src/db', () => ({
  query: jest.fn(),
  on: jest.fn(),
}));

jest.mock('axios');

const request = require('supertest');
const axios = require('axios');
const db = require('../src/db');
const app = require('../src/app');

/** room_id -> messages[] (forme colonnes SELECT *) */
const messagesByRoomId = new Map();

function messagesQueryImpl(sql, params) {
  if (sql.includes('FROM messages') && sql.includes('room_id')) {
    const roomId = params[0];
    const rows = messagesByRoomId.get(roomId) || [];
    return Promise.resolve({ rows });
  }
  return Promise.resolve({ rows: [] });
}

describe('Messaging Service', () => {
  const mockUserId = 'ca453145-bc8c-48c6-891e-e4c5ef7da610';

  beforeEach(() => {
    messagesByRoomId.clear();
    db.query.mockImplementation(messagesQueryImpl);
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
      const roomId = 'any-room-id';
      messagesByRoomId.set(roomId, [
        {
          id: '1',
          room_id: roomId,
          sender_id: mockUserId,
          content: 'hello',
          created_at: new Date().toISOString(),
        },
      ]);
      const res = await request(app)
        .get(`/messages/${roomId}`)
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
