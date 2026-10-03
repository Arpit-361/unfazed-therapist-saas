const crypto = require('crypto');
const config = require('../config/env');
const Client = require('../models/Client');
const Therapist = require('../models/Therapist');
const entitlementService = require('./entitlementService');
const { notify, EVENTS } = require('./notificationService');
const ApiError = require('../utils/ApiError');

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

async function issueInvite(clientId, therapistId) {
  const token = crypto.randomBytes(32).toString('hex');
  await Client.updateOne(
    { _id: clientId, therapist_id: therapistId },
    { invite_token_hash: hashToken(token), invite_expires_at: new Date(Date.now() + INVITE_TTL_MS) }
  );
  const inviteUrl = `${config.clientUrl}/portal/invite/${token}`;
  notify(EVENTS.CLIENT_INVITED, { therapistId, clientId, inviteUrl });
  return inviteUrl;
}

/** Creates a client for a therapist (enforcing the active-client entitlement) and issues an invite. */
async function createClientWithInvite(therapistId, data, source = 'therapist') {
  await entitlementService.assertAccess(therapistId, entitlementService.FEATURES.ACTIVE_CLIENTS);
  const existing = await Client.findOne({ therapist_id: therapistId, email: data.email.toLowerCase() }).lean();
  if (existing) throw ApiError.conflict('A client with this email already exists in your practice');

  const therapist = await Therapist.findById(therapistId).select('timezone').lean();
  const client = await Client.create({
    therapist_id: therapistId,
    name: data.name,
    email: data.email,
    phone: data.phone || '',
    tags: data.tags || [],
    timezone: data.timezone || therapist?.timezone || 'Asia/Kolkata',
    status: 'invited',
    source,
  });
  const inviteUrl = await issueInvite(client._id, therapistId);
  return { client, inviteUrl };
}

async function findClientByInviteToken(token) {
  if (!token || typeof token !== 'string') return null;
  return Client.findOne({ invite_token_hash: hashToken(token), invite_expires_at: { $gt: new Date() } }).select(
    '+invite_token_hash +invite_expires_at'
  );
}

module.exports = { createClientWithInvite, issueInvite, findClientByInviteToken };
