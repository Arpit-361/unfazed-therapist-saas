const mongoose = require('mongoose');
const Message = require('../models/Message');
const Client = require('../models/Client');
const entitlementService = require('../services/entitlementService');
const chatService = require('../services/chatService');
const { serializeMessage } = require('../utils/serializers');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// ---------- Therapist ----------

exports.listConversations = asyncHandler(async (req, res) => {
  const therapistId = new mongoose.Types.ObjectId(req.user.id);
  const clients = await Client.find({ therapist_id: therapistId, status: { $ne: 'archived' } })
    .select('name email status')
    .lean();

  const stats = await Message.aggregate([
    { $match: { therapist_id: therapistId } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$client_id',
        last_message: { $first: '$body' },
        last_sender: { $first: '$sender_role' },
        last_at: { $first: '$createdAt' },
        unread: { $sum: { $cond: [{ $and: [{ $eq: ['$sender_role', 'client'] }, { $eq: ['$read_at', null] }] }, 1, 0] } },
      },
    },
  ]);
  const byClient = Object.fromEntries(stats.map((s) => [String(s._id), s]));

  const conversations = clients
    .map((c) => {
      const s = byClient[String(c._id)];
      return {
        client: { id: String(c._id), name: c.name, email: c.email, status: c.status },
        last_message: s?.last_message || null,
        last_sender: s?.last_sender || null,
        last_at: s?.last_at || null,
        unread: s?.unread || 0,
      };
    })
    .sort((a, b) => (b.last_at ? new Date(b.last_at) : 0) - (a.last_at ? new Date(a.last_at) : 0));

  res.json({ success: true, conversations });
});

async function findOwnedClientId(therapistId, clientId) {
  if (!mongoose.isValidObjectId(clientId)) throw ApiError.notFound('Client not found');
  const client = await Client.findOne({ _id: clientId, therapist_id: therapistId }).select('_id').lean();
  if (!client) throw ApiError.notFound('Client not found');
  return client._id;
}

exports.therapistMessages = asyncHandler(async (req, res) => {
  const clientId = await findOwnedClientId(req.user.id, req.params.clientId);
  const messages = await Message.find({ therapist_id: req.user.id, client_id: clientId }).sort({ createdAt: 1 }).limit(500);
  await chatService.markRead(req.user.id, clientId, 'therapist');
  res.json({ success: true, messages: messages.map(serializeMessage) });
});

exports.therapistSend = asyncHandler(async (req, res) => {
  const clientId = await findOwnedClientId(req.user.id, req.params.clientId);
  const message = await chatService.persistMessage({
    therapistId: req.user.id,
    clientId,
    senderRole: 'therapist',
    body: req.body.body,
  });
  res.status(201).json({ success: true, message });
});

// ---------- Client portal ----------

exports.portalMessages = asyncHandler(async (req, res) => {
  await entitlementService.assertAccess(req.user.therapistId, entitlementService.FEATURES.CHAT);
  const messages = await Message.find({ therapist_id: req.user.therapistId, client_id: req.user.id })
    .sort({ createdAt: 1 })
    .limit(500);
  await chatService.markRead(req.user.therapistId, req.user.id, 'client');
  res.json({ success: true, messages: messages.map(serializeMessage) });
});

exports.portalSend = asyncHandler(async (req, res) => {
  const message = await chatService.persistMessage({
    therapistId: req.user.therapistId,
    clientId: req.user.id,
    senderRole: 'client',
    body: req.body.body,
  });
  res.status(201).json({ success: true, message });
});
