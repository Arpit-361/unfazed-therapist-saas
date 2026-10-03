const Message = require('../models/Message');
const entitlementService = require('./entitlementService');
const { serializeMessage } = require('../utils/serializers');
const ApiError = require('../utils/ApiError');

const MAX_BODY = 2000;

let emitter = null;
const setEmitter = (fn) => {
  emitter = fn;
};

/** Validates, entitlement-checks, stores and broadcasts a chat message. */
async function persistMessage({ therapistId, clientId, senderRole, body }) {
  const text = String(body || '').trim();
  if (!text) throw ApiError.badRequest('Message cannot be empty');
  if (text.length > MAX_BODY) throw ApiError.badRequest(`Message is too long (max ${MAX_BODY} characters)`);
  await entitlementService.assertAccess(therapistId, entitlementService.FEATURES.CHAT);

  const message = await Message.create({ therapist_id: therapistId, client_id: clientId, sender_role: senderRole, body: text });
  const payload = serializeMessage(message);
  if (emitter) emitter(payload);
  return payload;
}

async function markRead(therapistId, clientId, readerRole) {
  const otherRole = readerRole === 'therapist' ? 'client' : 'therapist';
  const result = await Message.updateMany(
    { therapist_id: therapistId, client_id: clientId, sender_role: otherRole, read_at: null },
    { read_at: new Date() }
  );
  return result.modifiedCount;
}

module.exports = { persistMessage, markRead, setEmitter };
