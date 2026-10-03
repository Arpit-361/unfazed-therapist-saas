const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema(
  {
    therapist_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Therapist', required: true, index: true },
    client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // therapist-local date
    status: { type: String, enum: ['waiting', 'notified', 'removed'], default: 'waiting' },
    notified_at: Date,
  },
  { timestamps: true }
);

waitlistSchema.index({ therapist_id: 1, client_id: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Waitlist', waitlistSchema);
