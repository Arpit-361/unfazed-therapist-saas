const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    therapist_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Therapist', required: true },
    client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    sender_role: { type: String, enum: ['therapist', 'client'], required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    read_at: { type: Date, default: null },
  },
  { timestamps: true }
);

messageSchema.index({ therapist_id: 1, client_id: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
