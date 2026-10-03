const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema(
  {
    therapist_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Therapist', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, maxlength: 20, default: '' },
    message: { type: String, trim: true, maxlength: 2000, default: '' },
    preferences: {
      language: { type: String, default: '' },
      specialization: { type: String, default: '' },
    },
    source: { type: String, enum: ['profile', 'directory'], default: 'profile' },
    status: { type: String, enum: ['new', 'contacted', 'converted', 'closed'], default: 'new' },
    converted_client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Lead', leadSchema);
