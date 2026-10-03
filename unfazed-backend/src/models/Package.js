const mongoose = require('mongoose');
const config = require('../config/env');

const packageSchema = new mongoose.Schema(
  {
    therapist_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Therapist', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 400, default: '' },
    session_count: { type: Number, required: true, enum: config.pricing.packageSizes },
    per_session_rate: { type: Number, required: true, min: 0 }, // paise
    duration_minutes: { type: Number, required: true, enum: config.scheduling.sessionDurations },
    validity_days: { type: Number, required: true, min: 7, max: 730 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Package', packageSchema);
