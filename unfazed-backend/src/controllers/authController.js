const bcrypt = require('bcryptjs');
const config = require('../config/env');
const Therapist = require('../models/Therapist');
const Client = require('../models/Client');
const Availability = require('../models/Availability');
const entitlementService = require('../services/entitlementService');
const clientService = require('../services/clientService');
const { signToken } = require('../middleware/authMiddleware');
const { generateUniqueSlug, validateSlugFormat } = require('../utils/generateSlug');
const { serializeTherapistPrivate, serializeClientSelf, serializeTherapistPublic } = require('../utils/serializers');
const { toPaise } = require('../utils/money');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const BCRYPT_ROUNDS = 10;

const DEFAULT_WEEKLY = [1, 2, 3, 4, 5].map((day) => ({ day_of_week: day, start: '10:00', end: '18:00' }));

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, slug: requestedSlug } = req.body;

  if (await Therapist.exists({ email: email.toLowerCase() })) {
    throw ApiError.conflict('An account with this email already exists');
  }

  let slug;
  if (requestedSlug) {
    const formatError = validateSlugFormat(requestedSlug);
    if (formatError) throw ApiError.badRequest(formatError);
    if (await Therapist.exists({ slug: requestedSlug })) throw ApiError.conflict('This profile link is already taken');
    slug = requestedSlug;
  } else {
    slug = await generateUniqueSlug(name, async (candidate) => Boolean(await Therapist.exists({ slug: candidate })));
  }

  const therapist = await Therapist.create({
    name,
    email,
    password_hash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    slug,
    subscription_tier: await entitlementService.getDefaultTierKey(),
    services: [
      {
        title: 'Individual Therapy Session',
        description: 'One-on-one online session.',
        duration_minutes: 60,
        price: toPaise(config.pricing.defaultSessionPriceInr),
      },
    ],
  });

  await Availability.create({
    therapist_id: therapist._id,
    timezone: therapist.timezone,
    weekly: DEFAULT_WEEKLY,
    session_durations: [60],
  });

  res.status(201).json({
    success: true,
    token: signToken({ id: therapist._id, role: 'therapist' }),
    user: serializeTherapistPrivate(therapist),
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const therapist = await Therapist.findOne({ email: email.toLowerCase() }).select('+password_hash');
  if (!therapist || !(await bcrypt.compare(password, therapist.password_hash))) {
    throw ApiError.unauthorized('Incorrect email or password');
  }
  res.json({
    success: true,
    token: signToken({ id: therapist._id, role: 'therapist' }),
    user: serializeTherapistPrivate(therapist),
  });
});

exports.clientLogin = asyncHandler(async (req, res) => {
  const { email, password, slug } = req.body;
  const filter = { email: email.toLowerCase(), password_hash: { $exists: true } };
  if (slug) {
    const therapist = await Therapist.findOne({ slug }).select('_id').lean();
    if (!therapist) throw ApiError.unauthorized('Incorrect email or password');
    filter.therapist_id = therapist._id;
  }

  const candidates = await Client.find(filter).select('+password_hash');
  const matches = [];
  for (const c of candidates) {
    if (await bcrypt.compare(password, c.password_hash)) matches.push(c);
  }
  if (!matches.length) throw ApiError.unauthorized('Incorrect email or password');
  if (matches.length > 1) {
    throw ApiError.badRequest('You are a client of more than one therapist. Log in from your therapist\'s page.');
  }

  const client = matches[0];
  if (['archived', 'inactive'].includes(client.status)) {
    throw ApiError.forbidden('Your portal access has been deactivated by your therapist');
  }
  client.last_login_at = new Date();
  await client.save();

  res.json({
    success: true,
    token: signToken({ id: client._id, role: 'client', therapistId: client.therapist_id }),
    user: serializeClientSelf(client),
  });
});

/** Self-signup from a therapist's branded page. Counts against that therapist's active-client cap. */
exports.clientRegister = asyncHandler(async (req, res) => {
  const { slug, name, email, password, phone, timezone } = req.body;
  const therapist = await Therapist.findOne({ slug }).lean();
  if (!therapist) throw ApiError.notFound('Therapist not found');
  if (!therapist.accepting_clients) throw ApiError.badRequest(`${therapist.name} is not accepting new clients right now`);

  if (await Client.exists({ therapist_id: therapist._id, email: email.toLowerCase() })) {
    throw ApiError.conflict('You already have an account with this therapist. Please log in.');
  }

  const access = await entitlementService.canAccess(therapist._id, entitlementService.FEATURES.ACTIVE_CLIENTS);
  if (!access.allowed) {
    throw ApiError.badRequest(`${therapist.name} is not accepting new clients online right now. Please send an enquiry instead.`);
  }

  const client = await Client.create({
    therapist_id: therapist._id,
    name,
    email,
    phone: phone || '',
    timezone: timezone || therapist.timezone,
    password_hash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    status: 'active',
    source: 'self_signup',
  });

  res.status(201).json({
    success: true,
    token: signToken({ id: client._id, role: 'client', therapistId: therapist._id }),
    user: serializeClientSelf(client),
  });
});

exports.getInvite = asyncHandler(async (req, res) => {
  const client = await clientService.findClientByInviteToken(req.params.token);
  if (!client) throw ApiError.notFound('This invitation link is invalid or has expired');
  const therapist = await Therapist.findById(client.therapist_id).lean();
  res.json({
    success: true,
    invite: { name: client.name, email: client.email, therapist: serializeTherapistPublic(therapist) },
  });
});

exports.acceptInvite = asyncHandler(async (req, res) => {
  const client = await clientService.findClientByInviteToken(req.params.token);
  if (!client) throw ApiError.notFound('This invitation link is invalid or has expired');

  client.password_hash = await bcrypt.hash(req.body.password, BCRYPT_ROUNDS);
  if (client.status === 'invited') client.status = 'active';
  if (req.body.timezone) client.timezone = req.body.timezone;
  client.invite_token_hash = undefined;
  client.invite_expires_at = undefined;
  client.last_login_at = new Date();
  await client.save();

  res.json({
    success: true,
    token: signToken({ id: client._id, role: 'client', therapistId: client.therapist_id }),
    user: serializeClientSelf(client),
  });
});

exports.me = asyncHandler(async (req, res) => {
  if (req.user.role === 'therapist') {
    const therapist = await Therapist.findById(req.user.id);
    return res.json({ success: true, user: serializeTherapistPrivate(therapist) });
  }
  const client = await Client.findById(req.user.id);
  return res.json({ success: true, user: serializeClientSelf(client) });
});
