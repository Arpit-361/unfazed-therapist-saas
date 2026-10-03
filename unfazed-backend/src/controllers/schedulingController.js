const Availability = require('../models/Availability');
const Session = require('../models/Session');
const Client = require('../models/Client');
const Therapist = require('../models/Therapist');
const Waitlist = require('../models/Waitlist');
const slotService = require('../services/slotService');
const bookingService = require('../services/bookingService');
const { notify, EVENTS } = require('../services/notificationService');
const { serializeSession } = require('../utils/serializers');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

function validateWindows(windows, label) {
  const sorted = [...windows].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  for (let i = 0; i < sorted.length; i += 1) {
    if (toMinutes(sorted[i].start) >= toMinutes(sorted[i].end)) {
      throw ApiError.badRequest(`${label}: start time must be before end time`);
    }
    if (i > 0 && toMinutes(sorted[i].start) < toMinutes(sorted[i - 1].end)) {
      throw ApiError.badRequest(`${label}: time ranges overlap`);
    }
  }
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ---------- Therapist: availability ----------

exports.getAvailability = asyncHandler(async (req, res) => {
  let availability = await Availability.findOne({ therapist_id: req.user.id });
  if (!availability) {
    const therapist = await Therapist.findById(req.user.id).select('timezone').lean();
    availability = await Availability.create({ therapist_id: req.user.id, timezone: therapist.timezone });
  }
  res.json({ success: true, availability });
});

exports.updateAvailability = asyncHandler(async (req, res) => {
  const { weekly, overrides, buffer_minutes, session_durations, min_notice_hours, booking_window_days, timezone } =
    req.body;

  if (weekly) {
    for (let d = 0; d < 7; d += 1) validateWindows(weekly.filter((w) => w.day_of_week === d), DAY_NAMES[d]);
  }
  if (overrides) {
    const dates = new Set();
    for (const o of overrides) {
      if (dates.has(o.date)) throw ApiError.badRequest(`Duplicate override for ${o.date}`);
      dates.add(o.date);
      if (!o.unavailable) {
        if (!o.windows || !o.windows.length) throw ApiError.badRequest(`Override ${o.date} needs at least one time range`);
        validateWindows(o.windows, `Override ${o.date}`);
      }
    }
  }
  if (buffer_minutes !== undefined && buffer_minutes % slotService.BLOCK_MINUTES !== 0) {
    throw ApiError.badRequest(`Buffer must be a multiple of ${slotService.BLOCK_MINUTES} minutes`);
  }

  const update = {};
  if (weekly) update.weekly = weekly;
  if (overrides) update.overrides = overrides;
  if (buffer_minutes !== undefined) update.buffer_minutes = buffer_minutes;
  if (session_durations) update.session_durations = [...new Set(session_durations)].sort((a, b) => a - b);
  if (min_notice_hours !== undefined) update.min_notice_hours = min_notice_hours;
  if (booking_window_days !== undefined) update.booking_window_days = booking_window_days;
  if (timezone) update.timezone = timezone;

  const availability = await Availability.findOneAndUpdate({ therapist_id: req.user.id }, update, {
    returnDocument: 'after',
    upsert: true,
    runValidators: true,
    setDefaultsOnInsert: true,
  });
  if (timezone) await Therapist.updateOne({ _id: req.user.id }, { timezone });
  res.json({ success: true, availability });
});

exports.addBlockedSlot = asyncHandler(async (req, res) => {
  const start = new Date(req.body.start);
  const end = new Date(req.body.end);
  if (!(start < end)) throw ApiError.badRequest('Block end must be after start');
  const availability = await Availability.findOneAndUpdate(
    { therapist_id: req.user.id },
    { $push: { blocked_slots: { start, end, reason: req.body.reason || '' } } },
    { returnDocument: 'after' }
  );
  res.status(201).json({ success: true, availability });
});

exports.removeBlockedSlot = asyncHandler(async (req, res) => {
  const availability = await Availability.findOneAndUpdate(
    { therapist_id: req.user.id },
    { $pull: { blocked_slots: { _id: req.params.blockId } } },
    { returnDocument: 'after' }
  );
  res.json({ success: true, availability });
});

exports.previewSlots = asyncHandler(async (req, res) => {
  const availability = await bookingService.getAvailabilityOrThrow(req.user.id);
  const from = req.query.from ? new Date(req.query.from) : new Date();
  const to = req.query.to ? new Date(req.query.to) : new Date(from.getTime() + 7 * 24 * 3600 * 1000);
  const durationMinutes = Number(req.query.duration) || availability.session_durations[0] || 60;
  const slots = await slotService.getAvailableSlots({
    therapistId: req.user.id,
    availability,
    from,
    to,
    durationMinutes,
    ignoreNotice: true,
  });
  res.json({ success: true, slots });
});

// ---------- Therapist: sessions ----------

exports.listSessions = asyncHandler(async (req, res) => {
  const filter = { therapist_id: req.user.id };
  if (req.query.from || req.query.to) {
    filter.start_time = {};
    if (req.query.from) filter.start_time.$gte = new Date(req.query.from);
    if (req.query.to) filter.start_time.$lte = new Date(req.query.to);
  }
  if (req.query.status) filter.status = { $in: String(req.query.status).split(',') };
  if (req.query.client_id) filter.client_id = req.query.client_id;

  const sessions = await Session.find(filter)
    .populate('client_id', 'name email')
    .sort({ start_time: req.query.order === 'desc' ? -1 : 1 })
    .limit(Math.min(Number(req.query.limit) || 500, 1000));
  res.json({ success: true, sessions: sessions.map(serializeSession) });
});

exports.createSessionForClient = asyncHandler(async (req, res) => {
  const { session } = await bookingService.createBooking({
    therapistId: req.user.id,
    clientId: req.body.client_id,
    serviceId: req.body.service_id,
    startTime: req.body.start_time,
    bookedBy: 'therapist',
    paymentMode: req.body.payment_mode || 'unpaid',
  });
  await session.populate('client_id', 'name email');
  res.status(201).json({ success: true, session: serializeSession(session) });
});

exports.updateSessionStatus = asyncHandler(async (req, res) => {
  const session = await Session.findOne({ _id: req.params.id, therapist_id: req.user.id });
  if (!session) throw ApiError.notFound('Session not found');
  const { status } = req.body;

  if (status === 'cancelled') {
    const updated = await bookingService.cancelSession(session, { reason: req.body.reason || 'Cancelled by therapist' });
    return res.json({ success: true, session: serializeSession(updated) });
  }

  if (!['confirmed', 'completed', 'no_show'].includes(session.status)) {
    throw ApiError.badRequest(`Cannot mark a ${session.status.replace('_', ' ')} session as ${status}`);
  }
  if (session.start_time > new Date()) {
    throw ApiError.badRequest('Only sessions that have started can be marked completed or no-show');
  }

  session.status = status;
  if (status === 'completed' && !session.followup_sent_at) {
    session.followup_sent_at = new Date();
    notify(EVENTS.SESSION_FOLLOWUP, { therapistId: session.therapist_id, clientId: session.client_id, session });
  }
  await session.save();
  await session.populate('client_id', 'name email');
  return res.json({ success: true, session: serializeSession(session) });
});

exports.listWaitlist = asyncHandler(async (req, res) => {
  const entries = await Waitlist.find({ therapist_id: req.user.id, status: { $ne: 'removed' } })
    .populate('client_id', 'name email')
    .sort({ date: 1 })
    .lean();
  res.json({
    success: true,
    waitlist: entries.map((e) => ({
      id: String(e._id),
      date: e.date,
      status: e.status,
      client: e.client_id ? { id: String(e.client_id._id), name: e.client_id.name, email: e.client_id.email } : null,
      created_at: e.createdAt,
    })),
  });
});

// ---------- Client portal ----------

exports.portalSlots = asyncHandler(async (req, res) => {
  const therapist = await Therapist.findById(req.user.therapistId).lean();
  const availability = await bookingService.getAvailabilityOrThrow(therapist._id);
  const service = therapist.services.find((s) => String(s._id) === String(req.query.service_id)) || therapist.services[0];
  if (!service) return res.json({ success: true, slots: [] });

  const from = req.query.from ? new Date(req.query.from) : new Date();
  const to = req.query.to ? new Date(req.query.to) : new Date(from.getTime() + 7 * 24 * 3600 * 1000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw ApiError.badRequest('Invalid date range');
  if (to - from > 62 * 24 * 3600 * 1000) throw ApiError.badRequest('Date range too large');

  const slots = availability.session_durations.includes(service.duration_minutes)
    ? await slotService.getAvailableSlots({
        therapistId: therapist._id,
        availability,
        from,
        to,
        durationMinutes: service.duration_minutes,
      })
    : [];
  return res.json({ success: true, slots, service_id: String(service._id), therapist_timezone: availability.timezone });
});

exports.portalBook = asyncHandler(async (req, res) => {
  const { session, checkout } = await bookingService.createBooking({
    therapistId: req.user.therapistId,
    clientId: req.user.id,
    serviceId: req.body.service_id,
    startTime: req.body.start_time,
    bookedBy: 'client',
    clientTimezone: req.body.client_timezone,
    paymentMode: req.body.payment_mode || 'pay_now',
  });
  res.status(201).json({ success: true, session: serializeSession(session), checkout });
});

exports.portalSessions = asyncHandler(async (req, res) => {
  const sessions = await Session.find({ client_id: req.user.id, therapist_id: req.user.therapistId }).sort({
    start_time: -1,
  });
  res.json({ success: true, sessions: sessions.map(serializeSession) });
});

exports.portalCancel = asyncHandler(async (req, res) => {
  const session = await Session.findOne({ _id: req.params.id, client_id: req.user.id, therapist_id: req.user.therapistId });
  if (!session) throw ApiError.notFound('Session not found');
  if (session.start_time <= new Date()) throw ApiError.badRequest('Past sessions cannot be cancelled');
  const updated = await bookingService.cancelSession(session, { reason: 'Cancelled by client' });
  res.json({ success: true, session: serializeSession(updated) });
});

exports.portalJoinWaitlist = asyncHandler(async (req, res) => {
  const { date } = req.body;
  const client = await Client.findById(req.user.id).lean();
  if (!client) throw ApiError.notFound('Client not found');
  const entry = await Waitlist.findOneAndUpdate(
    { therapist_id: req.user.therapistId, client_id: req.user.id, date },
    { status: 'waiting', notified_at: null },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  res.status(201).json({
    success: true,
    message: "You're on the waitlist. We'll notify you if a slot opens up on this day.",
    waitlist: { id: String(entry._id), date: entry.date, status: entry.status },
  });
});
