/**
 * Timezone-aware slot generation. Availability is defined in the therapist's local time
 * (weekly template + date overrides + blocked ranges); all generated slots are UTC instants.
 * Clients convert them to their own timezone for display.
 */
const { fromZonedTime, formatInTimeZone } = require('date-fns-tz');
const config = require('../config/env');
const Session = require('../models/Session');

const BLOCK_MINUTES = 5;
const MINUTE = 60 * 1000;

const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * MINUTE);

function nextDateString(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const dayOfWeek = (dateStr) => new Date(`${dateStr}T12:00:00Z`).getUTCDay();

function windowsForDate(availability, dateStr) {
  const override = (availability.overrides || []).find((o) => o.date === dateStr);
  if (override) return override.unavailable ? [] : override.windows || [];
  const dow = dayOfWeek(dateStr);
  return (availability.weekly || []).filter((w) => w.day_of_week === dow);
}

/** Slot keys cover [start, end + buffer) in 5-minute blocks; used by the unique index on Session. */
function buildSlotKeys(therapistId, start, durationMinutes, bufferMinutes) {
  const keys = [];
  const totalBlocks = Math.ceil((durationMinutes + bufferMinutes) / BLOCK_MINUTES);
  for (let i = 0; i < totalBlocks; i += 1) {
    keys.push(`${therapistId}:${addMinutes(start, i * BLOCK_MINUTES).toISOString()}`);
  }
  return keys;
}

async function loadBusyRanges(therapistId, availability, rangeStart, rangeEnd, excludeSessionId) {
  const lookback = addMinutes(rangeStart, -24 * 60);
  const query = {
    therapist_id: therapistId,
    slot_active: true,
    start_time: { $lt: rangeEnd },
    end_time: { $gt: lookback },
  };
  if (excludeSessionId) query._id = { $ne: excludeSessionId };
  const sessions = await Session.find(query).select('start_time end_time buffer_minutes').lean();

  const busy = sessions.map((s) => [s.start_time.getTime(), addMinutes(s.end_time, s.buffer_minutes || 0).getTime()]);
  for (const b of availability.blocked_slots || []) {
    busy.push([new Date(b.start).getTime(), new Date(b.end).getTime()]);
  }
  return busy;
}

/**
 * Returns available slots [{ start, end }] (ISO UTC) between `from` and `to`.
 * Options: ignoreNotice (therapist-side bookings may skip minimum-notice rule).
 */
async function getAvailableSlots({ therapistId, availability, from, to, durationMinutes, ignoreNotice = false }) {
  const tz = availability.timezone || 'Asia/Kolkata';
  const buffer = availability.buffer_minutes || 0;
  const step = config.scheduling.slotStepMinutes;
  const now = new Date();

  const earliest = ignoreNotice ? now : addMinutes(now, (availability.min_notice_hours || 0) * 60);
  const latest = addMinutes(now, (availability.booking_window_days || 30) * 24 * 60);
  const rangeStart = new Date(Math.max(from.getTime(), earliest.getTime()));
  const rangeEnd = new Date(Math.min(to.getTime(), latest.getTime()));
  if (rangeStart >= rangeEnd) return [];

  const busy = await loadBusyRanges(therapistId, availability, rangeStart, rangeEnd);
  const slots = [];

  let dateStr = formatInTimeZone(rangeStart, tz, 'yyyy-MM-dd');
  const lastDate = formatInTimeZone(rangeEnd, tz, 'yyyy-MM-dd');

  while (dateStr <= lastDate) {
    for (const w of windowsForDate(availability, dateStr)) {
      const windowStart = fromZonedTime(`${dateStr}T${w.start}:00`, tz);
      const windowEnd = fromZonedTime(`${dateStr}T${w.end}:00`, tz);
      for (let t = windowStart; addMinutes(t, durationMinutes) <= windowEnd; t = addMinutes(t, step)) {
        if (t < rangeStart || t >= rangeEnd) continue;
        const occupiedStart = t.getTime();
        const occupiedEnd = addMinutes(t, durationMinutes + buffer).getTime();
        const conflict = busy.some(([bs, be]) => occupiedStart < be && occupiedEnd > bs);
        if (!conflict) {
          slots.push({ start: t.toISOString(), end: addMinutes(t, durationMinutes).toISOString() });
        }
      }
    }
    dateStr = nextDateString(dateStr);
  }

  slots.sort((a, b) => a.start.localeCompare(b.start));
  return slots;
}

async function isSlotAvailable({ therapistId, availability, start, durationMinutes, ignoreNotice }) {
  const slots = await getAvailableSlots({
    therapistId,
    availability,
    from: start,
    to: addMinutes(start, 1),
    durationMinutes,
    ignoreNotice,
  });
  return slots.some((s) => s.start === start.toISOString());
}

module.exports = { getAvailableSlots, isSlotAvailable, buildSlotKeys, addMinutes, BLOCK_MINUTES };
