/**
 * Point d'entrée du service Messaging
 * Combine Express (API REST) et Socket.io (temps réel). Gère les messages de chat par room.
 * Auth via service Auth, stockage PostgreSQL, événements publiés sur RabbitMQ.
 * (Changement mineur pour inclure ce service dans le pipeline Jenkins sur le prochain push.)
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

const roomMembers = new Map();
const socketRooms = new Map();

function getRoomPresence(roomId) {
  const members = roomMembers.get(roomId);
  if (!members) return [];
  return [...members.entries()].map(([userId, socketIds]) => ({
    userId,
    connections: socketIds.size,
  }));
}

function emitRoomPresence(roomId) {
  io.to(roomId).emit('room_presence', {
    roomId,
    members: getRoomPresence(roomId),
  });
}

function addSocketToRoom(socket, roomId) {
  if (!roomId) return;
  const rooms = socketRooms.get(socket.id) || new Set();
  if (rooms.has(roomId)) return;

  rooms.add(roomId);
  socketRooms.set(socket.id, rooms);

  if (!roomMembers.has(roomId)) roomMembers.set(roomId, new Map());
  const members = roomMembers.get(roomId);
  if (!members.has(socket.userId)) members.set(socket.userId, new Set());
  members.get(socket.userId).add(socket.id);
}

function removeSocketFromRoom(socket, roomId) {
  const rooms = socketRooms.get(socket.id);
  if (rooms) {
    rooms.delete(roomId);
    if (rooms.size === 0) socketRooms.delete(socket.id);
  }

  const members = roomMembers.get(roomId);
  if (!members) return;

  const userSockets = members.get(socket.userId);
  if (userSockets) {
    userSockets.delete(socket.id);
    if (userSockets.size === 0) members.delete(socket.userId);
  }

  if (members.size === 0) roomMembers.delete(roomId);
}

function removeSocketFromAllRooms(socket) {
  const rooms = [...(socketRooms.get(socket.id) || [])];
  rooms.forEach((roomId) => {
    removeSocketFromRoom(socket, roomId);
    io.to(roomId).emit('user_left', { userId: socket.userId, roomId });
    emitRoomPresence(roomId);
  });
}

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
    if (!roomId) return;
    socket.join(roomId);
    addSocketToRoom(socket, roomId);
    io.to(roomId).emit('user_joined', { userId: socket.userId, roomId });
    emitRoomPresence(roomId);
  });

  socket.on('send_message', async ({ roomId, content }) => {
    if (!roomId || !content?.trim()) return;
    try {
      const result = await pool.query(
        'INSERT INTO messages (room_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *',
        [roomId, socket.userId, content.trim()]
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
    if (!roomId) return;
    socket.leave(roomId);
    removeSocketFromRoom(socket, roomId);
    io.to(roomId).emit('user_left', { userId: socket.userId, roomId });
    emitRoomPresence(roomId);
  });

  socket.on('typing_start', ({ roomId }) => {
    if (!roomId) return;
    socket.to(roomId).emit('typing', {
      roomId,
      userId: socket.userId,
      isTyping: true,
    });
  });

  socket.on('typing_stop', ({ roomId }) => {
    if (!roomId) return;
    socket.to(roomId).emit('typing', {
      roomId,
      userId: socket.userId,
      isTyping: false,
    });
  });

  socket.on('disconnect', () => {
    removeSocketFromAllRooms(socket);
    metrics.activeConnections.dec();
    console.log(`User disconnected: ${socket.userId}`);
  });
});

const PORT = process.env.PORT || 3003;
httpServer.listen(PORT, async () => {
  await connectRabbitMQ();
  console.log(`Messaging service running on port ${PORT}`);
});
