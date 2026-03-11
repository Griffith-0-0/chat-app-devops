/**
 * Point d'entrée du service Messaging
 * Combine Express (API REST) et Socket.io (temps réel). Gère les messages de chat par room.
 * Auth via service Auth, stockage PostgreSQL, événements publiés sur RabbitMQ.
 */
require("./instrument.js");

const { createServer } = require('http');
const { Server } = require('socket.io');
const pool = require('./db');
const { publish, connect: connectRabbitMQ } = require('./rabbitmq');
const axios = require('axios');
const metrics = require('./metrics');
require('dotenv').config();

const app = require('./app');

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

// Middleware Socket.io : vérifie le token auprès du service Auth avant d'accepter la connexion
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('No token'));
  try {
    const response = await axios.get(`${process.env.AUTH_SERVICE_URL}/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    socket.userId = response.data.userId;
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

// Événements WebSocket : join_room, send_message, leave_room
io.on('connection', (socket) => {
  metrics.activeConnections.inc();
  console.log(`User connected: ${socket.userId}`);

  socket.on('join_room', ({ roomId }) => {
    socket.join(roomId);
    io.to(roomId).emit('user_joined', { userId: socket.userId });
  });

  socket.on('send_message', async ({ roomId, content }) => {
    try {
      const result = await pool.query(
        'INSERT INTO messages (room_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *',
        [roomId, socket.userId, content]
      );
      const message = result.rows[0];
      metrics.messagesTotal.inc({ room_id: roomId || 'unknown' });
      io.to(roomId).emit('new_message', message);
      await publish({ type: 'new_message', message });
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('leave_room', ({ roomId }) => {
    socket.leave(roomId);
    io.to(roomId).emit('user_left', { userId: socket.userId });
  });

  socket.on('disconnect', () => {
    metrics.activeConnections.dec();
    console.log(`User disconnected: ${socket.userId}`);
  });
});

const PORT = process.env.PORT || 3003;
httpServer.listen(PORT, async () => {
  await connectRabbitMQ();
  console.log(`Messaging service running on port ${PORT}`);
});