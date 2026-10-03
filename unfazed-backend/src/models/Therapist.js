const mongoose = require('mongoose');
const config = require('../config/env');

const serviceSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, trim: true, maxlength: 400, default: '' },
  duration_minutes: { type: Number, required: true, enum: config.scheduling.sessionDurations },
  price: { type: Number, required: true, min: 0 }, // paise
});

const therapistSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    title: { type: String, trim: true, maxlength: 80, default: 'Therapist' },
    bio: { type: String, trim: true, maxlength: 3000, default: '' },
    specializations: [{ type: String, trim: true, maxlength: 60 }],
    languages: [{ type: String, trim: true, maxlength: 40 }],
    qualifications: { type: String, trim: true, maxlength: 300, default: '' },
    experience_years: { type: Number, min: 0, max: 70, default: 0 },
    city: { type: String, trim: true, maxlength: 60, default: '' },
    phone: { type: String, trim: true, maxlength: 20, default: '' },
    photo_url: { type: String, default: '' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    gstin: { type: String, trim: true, maxlength: 20, default: '' },
    accepting_clients: { type: Boolean, default: true },
    services: [serviceSchema],
    // Read and written exclusively by entitlementService.
    subscription_tier: { type: String, default: null },
    last_lead_assigned_at: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Therapist', therapistSchema);
