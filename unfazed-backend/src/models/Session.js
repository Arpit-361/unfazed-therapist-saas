const mongoose = require('mongoose');

const SESSION_STATUSES = ['pending_payment', 'confirmed', 'completed', 'cancelled', 'no_show'];

const sessionSchema = new mongoose.Schema(
  {
    therapist_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Therapist', required: true },
    client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    service_title: { type: String, default: 'Therapy session' },
    start_time: { type: Date, required: true }, // UTC
    end_time: { type: Date, required: true }, // UTC
    duration_minutes: { type: Number, required: true },
    buffer_minutes: { type: Number, default: 0 },
    status: { type: String, enum: SESSION_STATUSES, default: 'confirmed' },
    // Database-level double-booking protection: every active session owns 5-minute "slot keys"
    // covering [start, end + buffer). A unique partial index makes overlapping inserts fail.
    slot_active: { type: Boolean, default: true },
    slot_keys: { type: [String], default: [] },
    payment_status: { type: String, enum: ['unpaid', 'paid', 'package', 'waived'], default: 'unpaid' },
    payment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    client_package_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientPackage' },
    price: { type: Number, default: 0 }, // paise
    hold_expires_at: { type: Date, default: null },
    client_timezone: { type: String, default: 'Asia/Kolkata' },
    booked_by: { type: String, enum: ['client', 'therapist'], default: 'client' },
    meeting_link: { type: String, default: '' },
    cancelled_at: Date,
    cancel_reason: { type: String, default: '' },
    reminder_sent_at: Date,
    followup_sent_at: Date,
  },
  { timestamps: true }
);

sessionSchema.index({ therapist_id: 1, start_time: 1 });
sessionSchema.index(
  { slot_keys: 1 },
  { unique: true, partialFilterExpression: { slot_active: true }, name: 'unique_active_slot_keys' }
);

module.exports = mongoose.model('Session', sessionSchema);
module.exports.SESSION_STATUSES = SESSION_STATUSES;
