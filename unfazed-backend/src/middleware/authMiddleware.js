const jwt = require('jsonwebtoken');
const config = require('../config/env');
const Therapist = require('../models/Therapist');
const Client = require('../models/Client');
const ApiError = require('../utils/ApiError');

function signToken({ id, role, therapistId }) {
  const payload = { sub: String(id), role };
  if (role === 'client') payload.tid = String(therapistId);
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

/**
 * Verifies a JWT and loads the account it belongs to.
 * Returns a normalized identity: { id, role, therapistId }.
 * therapistId is the practice that owns the data the user may touch.
 */
async function resolveIdentity(token) {
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw ApiError.unauthorized('Invalid or expired session. Please log in again.');
  }

  if (payload.role === 'therapist') {
    const therapist = await Therapist.findById(payload.sub).select('_id').lean();
    if (!therapist) throw ApiError.unauthorized('Account no longer exists');
    return { id: String(therapist._id), role: 'therapist', therapistId: String(therapist._id) };
  }

  if (payload.role === 'client') {
    const client = await Client.findById(payload.sub).select('_id therapist_id status').lean();
    if (!client || String(client.therapist_id) !== payload.tid) {
      throw ApiError.unauthorized('Account no longer exists');
    }
    if (['archived', 'inactive'].includes(client.status)) {
      throw ApiError.forbidden('Your portal access has been deactivated by your therapist');
    }
    return { id: String(client._id), role: 'client', therapistId: String(client.therapist_id) };
  }

  throw ApiError.unauthorized('Invalid session');
}

async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw ApiError.unauthorized();
    req.user = await resolveIdentity(token);
    next();
  } catch (err) {
    next(err);
  }
}

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(ApiError.forbidden('This area is not available for your account type'));
  }
  return next();
};

module.exports = { protect, requireRole, signToken, resolveIdentity };
