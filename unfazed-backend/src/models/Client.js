const mongoose = require('mongoose');

const ACTIVE_CLIENT_STATUSES = ['invited', 'active'];

const consentRecordSchema = new mongoose.Schema(
  {
    version: { type: String, required: true },
    statement: { type: String, required: true },
    accepted: { type: Boolean, required: true },
    accepted_at: { type: Date, required: true },
    ip_address: { type: String, default: '' },
    user_agent: { type: String, default: '' },
  },
  { _id: true }
);

const intakeSchema = new mongoose.Schema(
  {
    demographics: {
      date_of_birth: { type: String, default: '' },
      gender: { type: String, default: '' },
      occupation: { type: String, default: '' },
      city: { type: String, default: '' },
      emergency_contact_name: { type: String, default: '' },
      emergency_contact_phone: { type: String, default: '' },
    },
    presenting_concern: { type: String, default: '' },
    history: {
      previous_therapy: { type: String, default: '' },
      medications: { type: String, default: '' },
      medical_conditions: { type: String, default: '' },
      family_history: { type: String, default: '' },
    },
    goals: { type: String, default: '' },
    submitted_at: { type: Date, default: null },
  },
  { _id: false }
);

const clientSchema = new mongoose.Schema(
  {
    therapist_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Therapist', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, maxlength: 20, default: '' },
    password_hash: { type: String, select: false },
    status: { type: String, enum: ['invited', 'active', 'inactive', 'archived'], default: 'invited' },
    tags: [{ type: String, trim: true, maxlength: 30 }],
    timezone: { type: String, default: 'Asia/Kolkata' },
    source: { type: String, enum: ['therapist', 'self_signup', 'lead'], default: 'therapist' },
    intake: { type: intakeSchema, default: () => ({}) },
    // Append-only audit trail of consent acceptance.
    consent_records: [consentRecordSchema],
    invite_token_hash: { type: String, select: false },
    invite_expires_at: { type: Date, select: false },
    last_login_at: Date,
  },
  { timestamps: true }
);

clientSchema.index({ therapist_id: 1, email: 1 }, { unique: true });

clientSchema.statics.ACTIVE_STATUSES = ACTIVE_CLIENT_STATUSES;

module.exports = mongoose.model('Client', clientSchema);
module.exports.ACTIVE_CLIENT_STATUSES = ACTIVE_CLIENT_STATUSES;
