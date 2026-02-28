const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const pool = require('./db');
const { publish, connect: connectRabbitMQ } = require('./rabbitmq');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const messageRoutes = require('./routes/messages');
app.use('/messages', messageRoutes);

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

io.on('connection', (socket) => {
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
    console.log(`User disconnected: ${socket.userId}`);
  });
});

const PORT = process.env.PORT || 3003;
httpServer.listen(PORT, async () => {
  await connectRabbitMQ();
  console.log(`Messaging service running on port ${PORT}`);
});