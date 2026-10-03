const mongoose = require('mongoose');

const clientPackageSchema = new mongoose.Schema(
  {
    therapist_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Therapist', required: true, index: true },
    client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    package_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Package', required: true },
    payment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    name: { type: String, required: true },
    sessions_total: { type: Number, required: true, min: 1 },
    sessions_used: { type: Number, default: 0, min: 0 },
    per_session_rate: { type: Number, required: true },
    duration_minutes: { type: Number, required: true },
    purchased_at: { type: Date, default: Date.now },
    expires_at: { type: Date, required: true },
    status: { type: String, enum: ['active', 'exhausted', 'expired'], default: 'active' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ClientPackage', clientPackageSchema);
