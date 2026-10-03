/**
 * Socket.io: authenticated connections, therapist-client conversation rooms, typing indicators,
 * read receipts and real-time notifications.
 *
 * Rooms:
 *   user:<role>:<id>               personal room (notifications, unread badges)
 *   conversation:<therapistId>:<clientId>  chat room shared by exactly one therapist and one client
 */
const { Server } = require('socket.io');
const Client = require('../models/Client');
const { resolveIdentity } = require('../middleware/authMiddleware');
const chatService = require('../services/chatService');
const { setSocketEmitter } = require('../services/notificationService');

let io = null;

const userRoom = (role, id) => `user:${role}:${id}`;
const conversationRoom = (therapistId, clientId) => `conversation:${therapistId}:${clientId}`;

function emitToUser(role, id, event, payload) {
  if (io) io.to(userRoom(role, id)).emit(event, payload);
}

function emitChatMessage(message) {
  if (!io) return;
  io.to(conversationRoom(message.therapist_id, message.client_id)).emit('chat:message', message);
  const recipient =
    message.sender_role === 'therapist' ? userRoom('client', message.client_id) : userRoom('therapist', message.therapist_id);
  io.to(recipient).emit('chat:unread', { therapist_id: message.therapist_id, client_id: message.client_id, message });
}

/** Resolves the conversation a socket may access; throws if the pair does not belong together. */
async function resolveConversation(user, clientId) {
  if (user.role === 'client') return { therapistId: user.therapistId, clientId: user.id };
  const client = await Client.findOne({ _id: clientId, therapist_id: user.id }).select('_id').lean();
  if (!client) throw new Error('Conversation not found');
  return { therapistId: user.id, clientId: String(client._id) };
}

const safeAck = (ack) => (typeof ack === 'function' ? ack : () => {});

function initSocket(httpServer, allowedOrigins) {
  io = new Server(httpServer, { cors: { origin: allowedOrigins, credentials: true } });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) throw new Error('Authentication required');
      socket.user = await resolveIdentity(token);
      next();
    } catch (err) {
      next(new Error(err.message || 'Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { user } = socket;
    socket.join(userRoom(user.role, user.id));
    if (user.role === 'client') socket.join(conversationRoom(user.therapistId, user.id));

    socket.on('chat:join', async ({ clientId } = {}, ack) => {
      const reply = safeAck(ack);
      try {
        const conv = await resolveConversation(user, clientId);
        socket.join(conversationRoom(conv.therapistId, conv.clientId));
        reply({ ok: true });
      } catch (err) {
        reply({ ok: false, error: err.message });
      }
    });

    socket.on('chat:leave', ({ clientId } = {}) => {
      if (user.role === 'therapist' && clientId) socket.leave(conversationRoom(user.id, clientId));
    });

    socket.on('chat:send', async ({ clientId, body } = {}, ack) => {
      const reply = safeAck(ack);
      try {
        const conv = await resolveConversation(user, clientId);
        const message = await chatService.persistMessage({ ...conv, senderRole: user.role, body });
        reply({ ok: true, message });
      } catch (err) {
        reply({ ok: false, error: err.message, code: err.code });
      }
    });

    socket.on('chat:typing', async ({ clientId, typing } = {}) => {
      try {
        const conv = await resolveConversation(user, clientId);
        socket.to(conversationRoom(conv.therapistId, conv.clientId)).emit('chat:typing', {
          ...{ therapist_id: conv.therapistId, client_id: conv.clientId },
          role: user.role,
          typing: Boolean(typing),
        });
      } catch {
        // ignore unauthorized typing events
      }
    });

    socket.on('chat:read', async ({ clientId } = {}) => {
      try {
        const conv = await resolveConversation(user, clientId);
        const count = await chatService.markRead(conv.therapistId, conv.clientId, user.role);
        if (count) {
          io.to(conversationRoom(conv.therapistId, conv.clientId)).emit('chat:read', {
            therapist_id: conv.therapistId,
            client_id: conv.clientId,
            reader_role: user.role,
            read_at: new Date().toISOString(),
          });
        }
      } catch {
        // ignore
      }
    });
  });

  chatService.setEmitter(emitChatMessage);
  setSocketEmitter(emitToUser);
  return io;
}

module.exports = { initSocket, emitToUser, emitChatMessage };
