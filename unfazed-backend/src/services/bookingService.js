/**
 * Booking rules shared by client self-booking and therapist-created sessions.
 */
const { formatInTimeZone } = require('date-fns-tz');
const config = require('../config/env');
const Therapist = require('../models/Therapist');
const Client = require('../models/Client');
const Availability = require('../models/Availability');
const Session = require('../models/Session');
const ClientPackage = require('../models/ClientPackage');
const Payment = require('../models/Payment');
const Waitlist = require('../models/Waitlist');
const slotService = require('./slotService');
const paymentService = require('./paymentService');
const { notify, EVENTS } = require('./notificationService');
const { consentStatus } = require('../utils/serializers');
const ApiError = require('../utils/ApiError');

async function getAvailabilityOrThrow(therapistId) {
  const availability = await Availability.findOne({ therapist_id: therapistId }).lean();
  if (!availability) throw ApiError.badRequest('This therapist has not published availability yet');
  return availability;
}

function resolveService(therapist, availability, serviceId) {
  const service = (therapist.services || []).find((s) => String(s._id) === String(serviceId));
  if (!service) throw ApiError.badRequest('Selected service does not exist');
  if (!(availability.session_durations || []).includes(service.duration_minutes)) {
    throw ApiError.badRequest(`${service.duration_minutes}-minute sessions are not currently offered`);
  }
  return service;
}

function assertClientReady(client) {
  if (!client.intake || !client.intake.submitted_at) {
    throw new ApiError(400, 'Intake form must be completed before the first session', { code: 'INTAKE_REQUIRED' });
  }
  if (!consentStatus(client).given) {
    throw new ApiError(400, 'Informed consent must be given before the first session', { code: 'CONSENT_REQUIRED' });
  }
}

async function consumePackageCredit({ therapistId, clientId, durationMinutes }) {
  const credit = await ClientPackage.findOneAndUpdate(
    {
      therapist_id: therapistId,
      client_id: clientId,
      status: 'active',
      duration_minutes: durationMinutes,
      expires_at: { $gt: new Date() },
      $expr: { $lt: ['$sessions_used', '$sessions_total'] },
    },
    { $inc: { sessions_used: 1 } },
    { sort: { expires_at: 1 }, returnDocument: 'after' }
  );
  if (!credit) throw ApiError.badRequest('No active package with remaining sessions for this session length');
  if (credit.sessions_used >= credit.sessions_total) {
    await ClientPackage.updateOne({ _id: credit._id }, { status: 'exhausted' });
  }
  return credit;
}

async function restorePackageCredit(clientPackageId) {
  await ClientPackage.updateOne(
    { _id: clientPackageId, sessions_used: { $gt: 0 } },
    { $inc: { sessions_used: -1 }, status: 'active' }
  );
}

/**
 * paymentMode: 'pay_now' (advance payment, slot held until paid) | 'package' (use a credit)
 *              | 'unpaid' / 'waived' (therapist-created sessions only)
 */
async function createBooking({ therapistId, clientId, serviceId, startTime, bookedBy, clientTimezone, paymentMode }) {
  const [therapist, client, availability] = await Promise.all([
    Therapist.findById(therapistId).lean(),
    Client.findOne({ _id: clientId, therapist_id: therapistId }).lean(),
    getAvailabilityOrThrow(therapistId),
  ]);
  if (!therapist) throw ApiError.notFound('Therapist not found');
  if (!client) throw ApiError.notFound('Client not found');
  if (!['active', 'invited'].includes(client.status)) throw ApiError.badRequest('Client is not active');
  if (bookedBy === 'client' && !['pay_now', 'package'].includes(paymentMode)) {
    throw ApiError.badRequest('Invalid payment option');
  }

  assertClientReady(client);
  const service = resolveService(therapist, availability, serviceId);

  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) throw ApiError.badRequest('Invalid start time');

  const available = await slotService.isSlotAvailable({
    therapistId,
    availability,
    start,
    durationMinutes: service.duration_minutes,
    ignoreNotice: bookedBy === 'therapist',
  });
  if (!available) throw ApiError.conflict('This slot is no longer available. Please choose another time.');

  let credit = null;
  if (paymentMode === 'package') {
    credit = await consumePackageCredit({ therapistId, clientId, durationMinutes: service.duration_minutes });
  }

  const buffer = availability.buffer_minutes || 0;
  const end = slotService.addMinutes(start, service.duration_minutes);
  const statusByMode = { pay_now: 'pending_payment', package: 'confirmed', unpaid: 'confirmed', waived: 'confirmed' };
  const paymentStatusByMode = { pay_now: 'unpaid', package: 'package', unpaid: 'unpaid', waived: 'waived' };

  let session;
  try {
    session = await Session.create({
      therapist_id: therapistId,
      client_id: clientId,
      service_title: service.title,
      start_time: start,
      end_time: end,
      duration_minutes: service.duration_minutes,
      buffer_minutes: buffer,
      status: statusByMode[paymentMode],
      payment_status: paymentStatusByMode[paymentMode],
      price: credit ? credit.per_session_rate : service.price,
      client_package_id: credit ? credit._id : undefined,
      hold_expires_at:
        paymentMode === 'pay_now' ? slotService.addMinutes(new Date(), config.pricing.paymentHoldMinutes) : null,
      client_timezone: clientTimezone || client.timezone,
      booked_by: bookedBy,
      slot_active: true,
      slot_keys: slotService.buildSlotKeys(therapistId, start, service.duration_minutes, buffer),
    });
  } catch (err) {
    if (credit) await restorePackageCredit(credit._id);
    if (err.code === 11000) {
      throw ApiError.conflict('This slot was just booked by someone else. Please choose another time.');
    }
    throw err;
  }

  if (client.status === 'invited' && bookedBy === 'client') {
    await Client.updateOne({ _id: clientId }, { status: 'active' });
  }

  let checkout = null;
  if (paymentMode === 'pay_now') {
    try {
      const result = await paymentService.createPaymentOrder({
        therapistId,
        clientId,
        purpose: 'session',
        baseAmount: service.price,
        description: `${service.title} (${service.duration_minutes} min) on ${formatInTimeZone(start, therapist.timezone, 'dd MMM yyyy, h:mm a')}`,
        sessionId: session._id,
      });
      session.payment_id = result.payment._id;
      await session.save();
      checkout = result.checkout;
    } catch (err) {
      await Session.updateOne(
        { _id: session._id },
        { status: 'cancelled', slot_active: false, cancelled_at: new Date(), cancel_reason: 'Payment could not be initiated' }
      );
      throw err;
    }
  } else {
    notify(EVENTS.BOOKING_CONFIRMED, { therapist, client, session });
  }

  return { session, checkout };
}

async function notifyWaitlist(session) {
  const availability = await Availability.findOne({ therapist_id: session.therapist_id }).lean();
  const tz = availability?.timezone || 'Asia/Kolkata';
  const date = formatInTimeZone(session.start_time, tz, 'yyyy-MM-dd');
  const entries = await Waitlist.find({ therapist_id: session.therapist_id, date, status: 'waiting' }).lean();
  for (const entry of entries) {
    await Waitlist.updateOne({ _id: entry._id }, { status: 'notified', notified_at: new Date() });
    notify(EVENTS.WAITLIST_SLOT_OPEN, { therapistId: session.therapist_id, clientId: entry.client_id, date });
  }
}

/** Cancels a session, releases the slot (for everyone else instantly) and restores credits. */
async function cancelSession(session, { reason = '', silent = false } = {}) {
  if (!['pending_payment', 'confirmed'].includes(session.status)) {
    throw ApiError.badRequest(`A ${session.status.replace('_', ' ')} session cannot be cancelled`);
  }
  const updated = await Session.findOneAndUpdate(
    { _id: session._id, status: { $in: ['pending_payment', 'confirmed'] } },
    { status: 'cancelled', slot_active: false, cancelled_at: new Date(), cancel_reason: reason },
    { returnDocument: 'after' }
  );
  if (!updated) throw ApiError.conflict('Session was already updated');

  if (updated.payment_status === 'package' && updated.client_package_id) {
    await restorePackageCredit(updated.client_package_id);
  }
  if (updated.payment_status === 'paid' && updated.payment_id) {
    await Payment.updateOne({ _id: updated.payment_id, status: 'paid' }, { status: 'refund_pending' });
  }
  if (updated.payment_id && updated.payment_status === 'unpaid') {
    await Payment.updateOne({ _id: updated.payment_id, status: 'created' }, { status: 'failed', failure_reason: reason });
  }

  if (!silent) notify(EVENTS.SESSION_CANCELLED, { therapistId: updated.therapist_id, clientId: updated.client_id, session: updated });
  if (updated.start_time > new Date()) await notifyWaitlist(updated);
  return updated;
}

async function releaseExpiredHolds() {
  const expired = await Session.find({ status: 'pending_payment', hold_expires_at: { $lt: new Date() } });
  for (const session of expired) {
    try {
      await cancelSession(session, { reason: 'Payment window expired', silent: true });
    } catch {
      // already handled concurrently
    }
  }
  return expired.length;
}

module.exports = { createBooking, cancelSession, releaseExpiredHolds, getAvailabilityOrThrow, resolveService };
