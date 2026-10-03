const mongoose = require('mongoose');
const Client = require('../models/Client');
const Therapist = require('../models/Therapist');
const Session = require('../models/Session');
const Payment = require('../models/Payment');
const SessionNote = require('../models/SessionNote');
const ClientPackage = require('../models/ClientPackage');
const entitlementService = require('../services/entitlementService');
const clientService = require('../services/clientService');
const { CONSENT_TEXT, CONSENT_VERSION } = require('../config/consent');
const {
  serializeClientForTherapist,
  serializeClientSelf,
  serializeSession,
  serializePayment,
  serializeNoteForTherapist,
  serializeClientPackage,
  serializeTherapistPublic,
} = require('../utils/serializers');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SORT_FIELDS = { name: 'name', created: 'createdAt', last_session: 'last_session', status: 'status', next_session: 'next_session' };

async function findOwnedClient(therapistId, clientId) {
  if (!mongoose.isValidObjectId(clientId)) throw ApiError.notFound('Client not found');
  // password_hash is only loaded to derive `portal_access`; serializers never emit it.
  const client = await Client.findOne({ _id: clientId, therapist_id: therapistId }).select('+password_hash');
  if (!client) throw ApiError.notFound('Client not found');
  return client;
}

// ---------- Therapist CRM ----------

exports.listClients = asyncHandler(async (req, res) => {
  const therapistId = new mongoose.Types.ObjectId(req.user.id);
  const match = { therapist_id: therapistId };
  if (req.query.status) match.status = { $in: String(req.query.status).split(',') };
  else match.status = { $ne: 'archived' };
  if (req.query.tag) match.tags = req.query.tag;
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(String(req.query.search).trim()), 'i');
    match.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }

  const sortField = SORT_FIELDS[req.query.sort] || 'name';
  const sortDir = req.query.order === 'desc' ? -1 : 1;
  const now = new Date();

  const clients = await Client.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'sessions',
        let: { cid: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$client_id', '$$cid'] },
              status: { $in: ['confirmed', 'completed', 'no_show', 'pending_payment'] },
            },
          },
          {
            $group: {
              _id: null,
              last_session: { $max: { $cond: [{ $lte: ['$start_time', now] }, '$start_time', null] } },
              next_session: { $min: { $cond: [{ $gt: ['$start_time', now] }, '$start_time', null] } },
              total_sessions: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            },
          },
        ],
        as: 'stats',
      },
    },
    {
      $addFields: {
        last_session: { $arrayElemAt: ['$stats.last_session', 0] },
        next_session: { $arrayElemAt: ['$stats.next_session', 0] },
        total_sessions: { $ifNull: [{ $arrayElemAt: ['$stats.total_sessions', 0] }, 0] },
        has_password: { $gt: ['$password_hash', null] },
      },
    },
    { $project: { stats: 0, password_hash: 0, invite_token_hash: 0, invite_expires_at: 0 } },
    { $sort: { [sortField]: sortDir, _id: 1 } },
  ]);

  const tags = await Client.distinct('tags', { therapist_id: therapistId });
  const access = await entitlementService.canAccess(req.user.id, entitlementService.FEATURES.ACTIVE_CLIENTS);

  res.json({
    success: true,
    clients: clients.map((c) =>
      serializeClientForTherapist(c, {
        last_session: c.last_session || null,
        next_session: c.next_session || null,
        total_sessions: c.total_sessions,
      })
    ),
    tags: tags.filter(Boolean).sort(),
    capacity: { usage: access.usage, limit: access.limit, allowed: access.allowed },
  });
});

exports.createClient = asyncHandler(async (req, res) => {
  const { client, inviteUrl } = await clientService.createClientWithInvite(req.user.id, req.body);
  res.status(201).json({ success: true, client: serializeClientForTherapist(client), invite_url: inviteUrl });
});

exports.getClient = asyncHandler(async (req, res) => {
  const client = await findOwnedClient(req.user.id, req.params.id);
  const scope = { therapist_id: req.user.id, client_id: client._id };

  const [sessions, payments, notes, packages] = await Promise.all([
    Session.find(scope).sort({ start_time: -1 }),
    Payment.find(scope).sort({ createdAt: -1 }),
    SessionNote.find(scope).sort({ createdAt: -1 }),
    ClientPackage.find(scope).sort({ createdAt: -1 }),
  ]);

  const paid = payments.filter((p) => p.status === 'paid');
  res.json({
    success: true,
    client: serializeClientForTherapist(client),
    sessions: sessions.map(serializeSession),
    payments: payments.map(serializePayment),
    notes: notes.map(serializeNoteForTherapist),
    packages: packages.map(serializeClientPackage),
    summary: {
      total_paid: paid.reduce((sum, p) => sum + p.amount, 0),
      completed_sessions: sessions.filter((s) => s.status === 'completed').length,
      no_shows: sessions.filter((s) => s.status === 'no_show').length,
      upcoming_sessions: sessions.filter((s) => s.start_time > new Date() && ['confirmed', 'pending_payment'].includes(s.status)).length,
    },
  });
});

exports.updateClient = asyncHandler(async (req, res) => {
  const client = await findOwnedClient(req.user.id, req.params.id);
  const { name, phone, tags, status, timezone } = req.body;

  if (status && status !== client.status) {
    const reactivating = Client.ACTIVE_CLIENT_STATUSES.includes(status) && !Client.ACTIVE_CLIENT_STATUSES.includes(client.status);
    if (reactivating) {
      await entitlementService.assertAccess(req.user.id, entitlementService.FEATURES.ACTIVE_CLIENTS);
    }
    if (status === 'invited' && client.status !== 'invited') throw ApiError.badRequest('Use "resend invite" instead');
    client.status = status;
  }
  if (name !== undefined) client.name = name;
  if (phone !== undefined) client.phone = phone;
  if (tags !== undefined) client.tags = [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  if (timezone !== undefined) client.timezone = timezone;
  await client.save();
  res.json({ success: true, client: serializeClientForTherapist(client) });
});

exports.resendInvite = asyncHandler(async (req, res) => {
  const client = await Client.findOne({ _id: req.params.id, therapist_id: req.user.id }).select('+password_hash');
  if (!client) throw ApiError.notFound('Client not found');
  if (client.password_hash) throw ApiError.badRequest('This client has already set up portal access');
  const inviteUrl = await clientService.issueInvite(client._id, req.user.id);
  res.json({ success: true, invite_url: inviteUrl });
});

// ---------- Client portal: self profile, intake & consent ----------

exports.portalMe = asyncHandler(async (req, res) => {
  const [client, therapist] = await Promise.all([
    Client.findById(req.user.id),
    Therapist.findById(req.user.therapistId).lean(),
  ]);
  const { FEATURES } = entitlementService;
  const [chat, packages, waitlist] = await Promise.all([
    entitlementService.canAccess(therapist._id, FEATURES.CHAT),
    entitlementService.canAccess(therapist._id, FEATURES.PACKAGES),
    entitlementService.canAccess(therapist._id, FEATURES.WAITLIST),
  ]);
  res.json({
    success: true,
    client: serializeClientSelf(client),
    therapist: serializeTherapistPublic(therapist),
    features: { chat: chat.allowed, packages: packages.allowed, waitlist: waitlist.allowed },
  });
});

exports.portalUpdateProfile = asyncHandler(async (req, res) => {
  const client = await Client.findById(req.user.id);
  if (req.body.name !== undefined) client.name = req.body.name;
  if (req.body.phone !== undefined) client.phone = req.body.phone;
  if (req.body.timezone !== undefined) client.timezone = req.body.timezone;
  await client.save();
  res.json({ success: true, client: serializeClientSelf(client) });
});

exports.portalSubmitIntake = asyncHandler(async (req, res) => {
  const client = await Client.findById(req.user.id);
  const { demographics = {}, presenting_concern, history = {}, goals } = req.body;
  client.intake = {
    demographics: {
      date_of_birth: demographics.date_of_birth || '',
      gender: demographics.gender || '',
      occupation: demographics.occupation || '',
      city: demographics.city || '',
      emergency_contact_name: demographics.emergency_contact_name || '',
      emergency_contact_phone: demographics.emergency_contact_phone || '',
    },
    presenting_concern,
    history: {
      previous_therapy: history.previous_therapy || '',
      medications: history.medications || '',
      medical_conditions: history.medical_conditions || '',
      family_history: history.family_history || '',
    },
    goals: goals || '',
    submitted_at: new Date(),
  };
  await client.save();
  res.json({ success: true, client: serializeClientSelf(client) });
});

exports.portalConsentText = asyncHandler(async (req, res) => {
  res.json({ success: true, version: CONSENT_VERSION, text: CONSENT_TEXT });
});

exports.portalGiveConsent = asyncHandler(async (req, res) => {
  if (req.body.accepted !== true) throw ApiError.badRequest('You must tick the consent checkbox to continue');
  if (req.body.version !== CONSENT_VERSION) {
    throw ApiError.badRequest('The consent form has been updated. Please review it again.');
  }
  const client = await Client.findById(req.user.id);
  client.consent_records.push({
    version: CONSENT_VERSION,
    statement: CONSENT_TEXT,
    accepted: true,
    accepted_at: new Date(),
    ip_address: req.ip || '',
    user_agent: String(req.headers['user-agent'] || '').slice(0, 300),
  });
  await client.save();
  res.status(201).json({ success: true, client: serializeClientSelf(client) });
});
