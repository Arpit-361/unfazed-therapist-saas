/**
 * Lightweight in-process job runner: releases expired payment holds and fires 24h reminders.
 */
const config = require('../config/env');
const Session = require('../models/Session');
const bookingService = require('./bookingService');
const { notify, EVENTS } = require('./notificationService');

let timer = null;

async function sendDueReminders() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const due = await Session.find({
    status: 'confirmed',
    start_time: { $gt: now, $lte: in24h },
    reminder_sent_at: null,
  }).lean();

  for (const session of due) {
    const claimed = await Session.updateOne(
      { _id: session._id, reminder_sent_at: null },
      { reminder_sent_at: new Date() }
    );
    if (claimed.modifiedCount) {
      notify(EVENTS.SESSION_REMINDER, { therapistId: session.therapist_id, clientId: session.client_id, session });
    }
  }
  return due.length;
}

async function tick() {
  try {
    await bookingService.releaseExpiredHolds();
    await sendDueReminders();
  } catch (err) {
    console.error('[scheduler] tick failed:', err.message);
  }
}

function start() {
  if (timer) return;
  timer = setInterval(tick, config.schedulerIntervalSeconds * 1000);
  timer.unref();
  setTimeout(tick, 5000).unref();
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, tick, sendDueReminders };
