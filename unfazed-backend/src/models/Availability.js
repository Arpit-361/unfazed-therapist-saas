const mongoose = require('mongoose');
const config = require('../config/env');

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const windowSchema = new mongoose.Schema(
  {
    start: { type: String, required: true, match: TIME_PATTERN },
    end: { type: String, required: true, match: TIME_PATTERN },
  },
  { _id: false }
);

const weeklySchema = new mongoose.Schema(
  {
    day_of_week: { type: Number, required: true, min: 0, max: 6 }, // 0 = Sunday
    start: { type: String, required: true, match: TIME_PATTERN },
    end: { type: String, required: true, match: TIME_PATTERN },
  },
  { _id: false }
);

const overrideSchema = new mongoose.Schema({
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // therapist-local date
  unavailable: { type: Boolean, default: false },
  windows: [windowSchema],
  note: { type: String, default: '', maxlength: 200 },
});

const blockedSlotSchema = new mongoose.Schema({
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  reason: { type: String, default: '', maxlength: 200 },
});

const availabilitySchema = new mongoose.Schema(
  {
    therapist_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Therapist', required: true, unique: true },
    timezone: { type: String, default: 'Asia/Kolkata' },
    weekly: [weeklySchema],
    overrides: [overrideSchema],
    blocked_slots: [blockedSlotSchema],
    buffer_minutes: { type: Number, default: 10, min: 0, max: 60 },
    session_durations: {
      type: [{ type: Number, enum: config.scheduling.sessionDurations }],
      default: [60],
    },
    min_notice_hours: { type: Number, default: 12, min: 0, max: 168 },
    booking_window_days: { type: Number, default: 30, min: 1, max: 180 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Availability', availabilitySchema);
